//! The request pipeline (port of `chassis/runtime/pipeline`): one mounted node, one snapshot,
//! phases in fixed order, first non-`continue` output wins.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use crate::engine::concerns::answer_cleardown::evaluate_answer_cleardown;
use crate::engine::concerns::reachability::{backlink_route_template_path, resolve_redirect, NodeMode, ReachabilityEvaluation};
use crate::engine::concerns::render::{render_page, Renderer};
use crate::engine::concerns::resolve::{resolve_view, RenderBlock, ResolveEnv};
use crate::engine::concerns::route::{hydrate_route_tree, resolve_redirect_target};
use crate::engine::concerns::validation::{RuleFilter, ValidationResult, ValidationView};
use crate::engine::errors::{ForgeError, ForgeResult, InPhase};
use crate::engine::mount::{MountedKind, MountedNode};
use crate::engine::runtime::context::{RequestContext, RuntimeContext, SharedContext};
use crate::engine::tracing::{self, fields, Instrumentation, LateValues, PhaseSnapshot, Projection, Span, TraceResult};
use crate::framework::{HttpMethod, Outcome, OutcomeError, OutcomeKind, RequestSnapshot, ResponseBindings};
use crate::route_path::resolve_path_params;
use crate::value::{Map, Value};

/// A phase's verdict (`PhaseWorkOutput`).
#[derive(Debug)]
pub enum PhaseOutput {
    Continue,
    /// A route-template path or redirect string, resolved to a URL at the end.
    Redirect(String),
    Error { status: u16, message: String },
    Render { context: Value, output: Option<Value> },
}

/// Cross-phase request state (`RequestState`).
pub struct RequestState {
    pub ctx: SharedContext,
    pub node: Arc<MountedNode>,
    pub response: Arc<dyn ResponseBindings>,
    pub current_page_validation: Option<ValidationView>,
    pub reachability_evaluation: Option<ReachabilityEvaluation>,
    pub route_tree: Option<Value>,
    /// The `request.pipeline` root span (disabled when the request is not traced).
    pub trace: Span,
    /// The phase currently running and its index under the root.
    phase: Option<(usize, Span)>,
    phase_snapshots: Vec<PhaseSnapshot>,
}

impl RequestState {
    /// `validation.current-step`: validates the current step and records the display result.
    pub async fn validate_current_step(
        &mut self,
        groups: &[String],
        include_submission_only: bool,
        parent: &Span,
        key: &str,
    ) -> ForgeResult<bool> {
        let MountedKind::Step(step) = &self.node.kind else {
            return Err(ForgeError::evaluation("Current-step validation requires a current step id"));
        };
        let span = parent.child(key, "validation.current-step", || {
            fields([
                ("groups", Value::array(groups.iter().map(|g| Value::from(g.as_str())).collect())),
                ("includeSubmissionOnly", Value::Bool(include_submission_only)),
            ])
        });
        let filter = RuleFilter { groups: groups.to_vec(), include_submission_only };
        let validity =
            step.validation.run(&self.ctx, &filter, &span, &validation_task_key(&self.node.node_id)).await.in_phase("validation")?;
        let view = ValidationView::from(validity);
        let valid = view.is_valid;
        self.current_page_validation = Some(view);
        span.complete(|| fields([("isValid", Value::Bool(valid))]));
        Ok(valid)
    }

    /// Opens the next phase span (`request.<name>`).
    fn begin_phase(&mut self, name: &str) -> Span {
        let index = tracing::phase_count(&self.trace);
        let span = self.trace.open(name, &format!("request.{name}"));
        self.phase = Some((index, span.clone()));
        span
    }

    /// Completes the running phase, capturing the context snapshot TS records at phase finish.
    fn end_phase(&mut self) {
        let Some((index, span)) = self.phase.take() else { return };
        if span.enabled() {
            let data = tracing::capture_context_snapshot(&self.ctx.lock());
            span.done();
            self.phase_snapshots.push(PhaseSnapshot { phase_index: index, data });
        }
    }
}

/// `validationTaskKey`.
pub fn validation_task_key(step_id: &str) -> String {
    format!("validation:{step_id}")
}

/// `RequestPipeline.evaluate`.
pub async fn evaluate(
    node: Arc<MountedNode>,
    snapshot: &RequestSnapshot,
    response: Arc<dyn ResponseBindings>,
    renderer: Option<Arc<dyn Renderer>>,
    max_iterations: usize,
    instrumentation: &Instrumentation,
) -> ForgeResult<Outcome> {
    let instrumentation = instrumentation.for_request(snapshot);
    let mut runtime = RuntimeContext::default();
    runtime.evaluation.max_iterations = max_iterations;
    let ctx = SharedContext::new(runtime);
    let mut state = RequestState {
        ctx: ctx.clone(),
        node: node.clone(),
        response,
        current_page_validation: None,
        reachability_evaluation: None,
        route_tree: None,
        trace: if instrumentation.enabled() { Span::root("request", "request.pipeline") } else { Span::disabled() },
        phase: None,
        phase_snapshots: Vec::new(),
    };
    let result = run_pipeline(&mut state, snapshot, renderer.as_ref()).await;
    if instrumentation.enabled() {
        emit_trace(&mut state, snapshot, &result, &instrumentation);
    }
    let output = result?;
    let session = ctx.lock().request.session.clone();
    let kind = match output {
        PhaseOutput::Redirect(target) => OutcomeKind::Navigate { url: redirect_url(&target, snapshot)? },
        PhaseOutput::Error { status, message } => OutcomeKind::Error(OutcomeError { status, message }),
        PhaseOutput::Render { context, output } => OutcomeKind::Render { context, output },
        PhaseOutput::Continue => return Err(ForgeError::evaluation("Request pipeline completed without a result")),
    };
    Ok(Outcome { kind, session })
}

async fn run_pipeline(
    state: &mut RequestState,
    snapshot: &RequestSnapshot,
    renderer: Option<&Arc<dyn Renderer>>,
) -> ForgeResult<PhaseOutput> {
    let output = match run_phases(state, snapshot).await? {
        PhaseOutput::Render { context, output: None } if renderer.is_some() => {
            let renderer = renderer.expect("checked above");
            let span = state.begin_phase("render");
            let request_state = state.ctx.lock().request.state.clone();
            let output = render_page(&context, renderer, &state.node.components, &request_state, &span)?;
            state.end_phase();
            PhaseOutput::Render { context, output: Some(output) }
        }
        other => other,
    };
    state.trace.done();
    Ok(output)
}

/// `RequestPipelineTraceProjector.emit` / `emitFailed`.
fn emit_trace(
    state: &mut RequestState,
    snapshot: &RequestSnapshot,
    result: &ForgeResult<PhaseOutput>,
    instrumentation: &Instrumentation,
) {
    let trace_result = match result {
        Ok(PhaseOutput::Redirect(target)) => {
            TraceResult::Redirect(redirect_url(target, snapshot).unwrap_or_else(|_| target.clone()))
        }
        Ok(PhaseOutput::Error { status, message }) => TraceResult::HaltError { status: *status, message: message.clone() },
        Ok(_) => TraceResult::Render,
        Err(error) => {
            // The failed phase never completed: snapshot the context as it was when it failed.
            if let Some((index, _)) = state.phase.take() {
                let data = tracing::capture_context_snapshot(&state.ctx.lock());
                state.phase_snapshots.push(PhaseSnapshot { phase_index: index, data });
            }
            TraceResult::Failed { status: error.status(), message: error.to_string(), stack: None }
        }
    };
    let (late, session) = {
        let ctx = state.ctx.lock();
        (LateValues { answers: ctx.answers_value() }, ctx.request.session.clone())
    };
    // TS sinks receive the snapshot whose session object effects mutated in place, so the
    // trace carries the session as it is at the end of the request.
    let mut snapshot_value = tracing::snapshot_value(snapshot);
    if !snapshot.session.is_nullish() || !session.is_nullish() {
        snapshot_value.set("session", if snapshot.session.is_nullish() { snapshot.session.clone() } else { session });
    }
    let event = tracing::project(Projection {
        snapshot: snapshot_value,
        root: &state.trace,
        phase_snapshots: &state.phase_snapshots,
        result: trace_result,
        reachability: state.reachability_evaluation.as_ref().map(tracing::reachability_value),
        route: trace_route(&state.node, state.route_tree.as_ref()),
        late,
    });
    if let Some(event) = event {
        instrumentation.on_request_trace(&event);
    }
}

/// `traceRoute`: journey code and template path, plus titles from the active route-tree branch.
fn trace_route(node: &MountedNode, route_tree: Option<&Value>) -> Value {
    let mut branch = Vec::new();
    let mut level = route_tree.cloned();
    while let Some(nodes) = level.as_ref().and_then(|l| l.as_array().cloned()) {
        let Some(active) = nodes.iter().find(|n| n.get("active").truthy()).cloned() else { break };
        level = Some(active.get("children"));
        branch.push(active);
    }
    let journey_title = branch.iter().find(|n| n.get("route").get("kind").as_str() == Some("journey")).map(|n| n.get("route").get("title"));
    let step_title = branch
        .iter()
        .find(|n| n.get("route").get("nodeId").as_str() == Some(&*node.node_id))
        .map(|n| n.get("route").get("title"))
        .filter(|t| !t.is_undefined())
        .or_else(|| branch.iter().rev().find(|n| !n.get("route").is_undefined()).map(|n| n.get("route").get("title")));
    Value::from_pairs([
        ("journeyCode", Value::from(node.journey_code.as_str())),
        ("routeTemplatePath", Value::from(node.template_path.as_str())),
        ("journeyTitle", journey_title.unwrap_or_default()),
        ("stepTitle", step_title.unwrap_or_default()),
    ])
}

fn redirect_url(target: &str, snapshot: &RequestSnapshot) -> ForgeResult<String> {
    let with_params = resolve_path_params(target, &snapshot.params);
    let loc = &snapshot.location;
    resolve_redirect_target(&with_params, &loc.origin, &loc.pathname, Some(&loc.base_path))
}

async fn run_phases(state: &mut RequestState, snapshot: &RequestSnapshot) -> ForgeResult<PhaseOutput> {
    let node = state.node.clone();

    state.begin_phase("context-preparation");
    {
        let mut ctx = state.ctx.lock();
        for (k, v) in node.static_data.iter() {
            ctx.domain.data.insert(k.clone(), v.clone());
        }
        ctx.request = RequestContext {
            url: snapshot.location.href.clone(),
            path: snapshot.location.pathname.clone(),
            method: snapshot.method.as_str().to_string(),
            location: snapshot.location.clone(),
            headers: snapshot.headers.clone(),
            cookies: snapshot.cookies.clone(),
            state: snapshot.state.clone(),
            params: snapshot.params.clone(),
            query: snapshot.query.clone(),
            post: snapshot.post.clone(),
            session: if snapshot.session.is_nullish() { Value::empty_object() } else { snapshot.session.clone() },
        };
    }
    state.end_phase();

    let span = state.begin_phase("access");
    let access = node.access.run(state, &span).await.in_phase("hooks")?;
    state.end_phase();
    if !matches!(access, PhaseOutput::Continue) {
        return Ok(access);
    }

    let span = state.begin_phase("answer-preparation");
    node.answer_preparation.run(&state.ctx, &node.components, &span).await.in_phase("answer-preparation")?;
    state.end_phase();

    let span = state.begin_phase("validities");
    let mut validities = HashMap::new();
    for (step_id, validation) in &node.journey.step_validations {
        let result = validation
            .run(&state.ctx, &RuleFilter::reachability(), &span, &validation_task_key(step_id))
            .await
            .in_phase("validation")?;
        validities.insert(step_id.clone(), result.is_valid());
        state.ctx.lock().evaluation.reachability_validities.get_or_insert_with(Default::default).insert(step_id.clone(), result);
    }
    state.end_phase();

    state.begin_phase("reachability");
    let is_step = matches!(node.kind, MountedKind::Step(_));
    let params = state.ctx.lock().request.params.clone();
    let inventory =
        if is_step { Some(node.journey.field_inventory.evaluate(&state.ctx).await.in_phase("field-inventory")?) } else { None };
    let current = if is_step { Some(&node.node_id) } else { None };
    let (evaluation, projection) = node
        .journey
        .reachability
        .evaluate(
            &state.ctx,
            &node.journey.catalog,
            current,
            &validities,
            inventory.as_deref().map(|i| (i, &params)),
        )
        .await
        .in_phase("reachability")?;
    if let Some(p) = projection {
        state.ctx.lock().evaluation.reachability = Some(Arc::new(p));
    }
    let mode = if is_step { NodeMode::Step } else { NodeMode::Journey };
    let redirect = resolve_redirect(&evaluation, mode, snapshot.method == HttpMethod::Get);
    state.reachability_evaluation = Some(evaluation);
    state.end_phase();
    let MountedKind::Step(step) = &node.kind else {
        return match redirect {
            Some(target) => Ok(PhaseOutput::Redirect(target)),
            None => Err(ForgeError::evaluation("No steps found in journey")),
        };
    };
    if let Some(target) = redirect {
        return Ok(PhaseOutput::Redirect(target));
    }

    state.begin_phase("answer-cleardown");
    {
        let mut ctx = state.ctx.lock();
        if let Some(projection) = ctx.evaluation.reachability.clone() {
            let cleared = evaluate_answer_cleardown(&projection, &mut ctx.domain.answers)?;
            ctx.evaluation.fields_to_clear = Some(cleared.into_iter().map(Into::into).collect());
        }
    }
    state.end_phase();

    if snapshot.method == HttpMethod::Post {
        let span = state.begin_phase("submit");
        let submit = step.submit.run(state, &span).await.in_phase("hooks")?;
        state.end_phase();
        if !matches!(submit, PhaseOutput::Continue) {
            return Ok(submit);
        }
    } else {
        let span = state.begin_phase("entry-validation");
        let groups = step.entry_validation.select_groups(&state.ctx).await.in_phase("entry-validation")?;
        if !groups.is_empty() {
            state.validate_current_step(&groups, false, &span, "entry-validation").await?;
        }
        state.end_phase();
    }

    state.begin_phase("route-tree");
    let metadata = node.route_metadata.evaluate(&state.ctx).await.in_phase("route-tree")?;
    let tree = {
        let roots = node.route_tree.read().unwrap();
        hydrate_route_tree(&roots.roots, &step.template_path, &params, &metadata)
    };
    state.route_tree = Some(tree);
    state.end_phase();

    let span = state.begin_phase("resolve");
    let output = resolve(state, &step.resolve, &span).await?;
    state.end_phase();
    Ok(output)
}

async fn resolve(
    state: &mut RequestState,
    compiled: &crate::engine::concerns::resolve::CompiledResolve,
    span: &Span,
) -> ForgeResult<PhaseOutput> {
    let validation = state.current_page_validation.clone();
    let mut field_failures: HashMap<Arc<str>, Vec<ValidationResult>> = HashMap::new();
    for f in validation.iter().flat_map(|v| v.field_failures.iter()) {
        if let Some(id) = &f.block_id {
            field_failures.entry(id.clone()).or_default().push(ValidationResult { block_id: None, ..f.clone() });
        }
    }
    let env = Arc::new(ResolveEnv {
        ctx: state.ctx.clone(),
        components: state.node.components.clone(),
        field_failures,
        anchors: Mutex::new(HashMap::new()),
    });
    let (blocks, step_value, ancestors) = compiled.run(env.clone()).await.in_phase("resolve")?;
    trace_resolved_blocks(span, &blocks);

    let params = state.ctx.lock().request.params.clone();
    let mut step_value = step_value;
    if step_value.get("backlink").is_undefined()
        && let Some(eval) = &state.reachability_evaluation
        && let Some(back) = backlink_route_template_path(eval)
    {
        step_value.set("backlink", Value::from(resolve_path_params(&back, &params)));
    }
    let view = resolve_view(&ancestors, &step_value.get("view"));
    if !view.is_undefined() {
        step_value.set("view", view);
    }

    let anchors = env.anchors.lock().unwrap().clone();
    let show = validation.is_some();
    let field_errors: Vec<Value> = validation
        .iter()
        .flat_map(|v| v.field_failures.iter())
        .map(|f| {
            let mut v = f.to_value();
            if let Some(anchor) = f.block_id.as_ref().and_then(|id| anchors.get(id)) {
                v.set("anchor", Value::from(anchor.as_str()));
            }
            v
        })
        .collect();
    let domain_errors: Vec<Value> =
        validation.iter().flat_map(|v| v.domain_failures.iter()).map(ValidationResult::to_value).collect();
    let (answers, data) = {
        let ctx = state.ctx.lock();
        (ctx.answers_value(), Value::object(ctx.domain.data.clone()))
    };
    let mut context = Map::new();
    context.insert("routeTree".into(), state.route_tree.clone().unwrap_or_else(|| Value::array(vec![])));
    context.insert("step".into(), step_value);
    context.insert("ancestors".into(), Value::array(ancestors));
    context.insert("blocks".into(), Value::array(blocks));
    context.insert("showValidationFailures".into(), Value::Bool(show));
    context.insert("fieldValidationErrors".into(), Value::array(field_errors));
    context.insert("domainValidationErrors".into(), Value::array(domain_errors));
    context.insert("answers".into(), answers);
    context.insert("data".into(), data);
    Ok(PhaseOutput::Render { context: Value::object(context), output: None })
}

/// The `resolve-blocks` unit and its `resolve.block` tree. TS evaluates block properties while
/// building the block tasks, nested blocks becoming child tasks inside their parent's properties;
/// the spans record that structure, so they are built here from the resolved blocks.
fn trace_resolved_blocks(parent: &Span, blocks: &[Value]) {
    if !parent.enabled() {
        return;
    }
    let span = parent.child("resolve-blocks", "resolve.blocks", || fields([("blocks", Value::from(blocks.len()))]));
    for block in blocks {
        trace_block(&span, block);
    }
    let visible = blocks.iter().filter(|b| !b.get("properties").get("visibleWhen").strict_eq(&Value::Bool(false))).count();
    span.complete(|| fields([("visibleBlocks", Value::from(visible))]));
}

fn trace_block(parent: &Span, block: &Value) {
    let Some(rb) = block.downcast::<RenderBlock>() else { return };
    let span = parent.child(rb.id.to_string(), "resolve.block", || {
        fields([
            ("id", Value::String(rb.id.clone())),
            ("variant", Value::String(rb.variant.clone())),
            ("blockType", Value::from(rb.block_type)),
        ])
    });
    collect_nested_blocks(&rb.properties, &mut |nested| trace_block(&span, nested));
    span.complete(|| {
        fields([
            ("visible", Value::Bool(!rb.properties.get("visibleWhen").strict_eq(&Value::Bool(false)))),
            ("properties", rb.properties.clone()),
        ])
    });
}

/// `WorkTaskPropsWalker.collect`: blocks inside arrays and plain records, not below a block.
fn collect_nested_blocks(value: &Value, f: &mut impl FnMut(&Value)) {
    match value {
        Value::Opaque(_) if value.downcast::<RenderBlock>().is_some() => f(value),
        Value::Array(items) => items.iter().for_each(|i| collect_nested_blocks(i, f)),
        Value::Object(map) => map.values().for_each(|v| collect_nested_blocks(v, f)),
        _ => {}
    }
}
