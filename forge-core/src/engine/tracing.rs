//! Request tracing (port of `chassis/tracing` and `RequestPipelineTraceProjector`).
//!
//! TS records a `TraceSpan` per work task as the `WorkExecutor` runs the task tree. Rust runs phases
//! directly, so the same spans are opened explicitly at the points where TS would schedule a work
//! task, with the same keys, kinds and begin/complete fields. When no sink wants the request every
//! [`Span`] is a no-op and field closures never run.
//!
//! Spans form a tree held in one arena per request. A [`Span`] is a cheap handle (arena plus index)
//! that concurrent children can share.

use std::sync::{Arc, Mutex, OnceLock};
use std::time::Instant;

use crate::framework::RequestSnapshot;
use crate::value::{Map, Value};

/// `performance.now()`: milliseconds since a process-wide origin.
pub fn now_ms() -> f64 {
    static ORIGIN: OnceLock<Instant> = OnceLock::new();
    ORIGIN.get_or_init(Instant::now).elapsed().as_secs_f64() * 1000.0
}

/// `ForgeInstrumentationSink`.
pub trait InstrumentationSink: Send + Sync {
    fn on_request_trace(&self, event: &RequestTraceEvent);

    /// `onCompilationTrace`: one trace per package compilation (optional, as in TS).
    fn on_compilation_trace(&self, _event: &CompilationTraceEvent) {}

    /// Per-request opt-in. Sinks that return false for a request get no trace for it, and when no
    /// sink wants a request nothing is recorded at all.
    fn should_trace(&self, _snapshot: &RequestSnapshot) -> bool {
        true
    }
}

/// `ForgeTraceSinkDispatcher`.
#[derive(Clone, Default)]
pub struct Instrumentation {
    sinks: Vec<Arc<dyn InstrumentationSink>>,
}

impl Instrumentation {
    pub fn new(sinks: Vec<Arc<dyn InstrumentationSink>>) -> Self {
        Self { sinks }
    }

    pub fn push(&mut self, sink: Arc<dyn InstrumentationSink>) {
        self.sinks.push(sink);
    }

    pub fn enabled(&self) -> bool {
        !self.sinks.is_empty()
    }

    /// `forRequest`: the sinks that want this request, decided once at request start.
    pub fn for_request(&self, snapshot: &RequestSnapshot) -> Instrumentation {
        Self { sinks: self.sinks.iter().filter(|s| s.should_trace(snapshot)).cloned().collect() }
    }

    pub fn on_request_trace(&self, event: &RequestTraceEvent) {
        for sink in &self.sinks {
            sink.on_request_trace(event);
        }
    }

    pub fn on_compilation_trace(&self, event: &CompilationTraceEvent) {
        for sink in &self.sinks {
            sink.on_compilation_trace(event);
        }
    }
}

/// A field resolved when the trace is projected rather than when the span completes. TS stores
/// some fields by reference (`answer.preparation`'s `answers` is the live answers record), so the
/// serialised trace shows their state at the end of the request.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum LateField {
    /// `context.domain.answers` at the end of the request.
    Answers,
}

#[derive(Default)]
struct SpanNode {
    key: String,
    kind: String,
    children: Vec<usize>,
    begin_fields: Map,
    complete_fields: Map,
    late_fields: Vec<(String, LateField)>,
    completed: bool,
    started_at_ms: f64,
    completed_at_ms: Option<f64>,
    omit: bool,
}

#[derive(Default)]
struct Arena {
    nodes: Vec<SpanNode>,
}

/// A trace span handle (`TraceSpan`). Disabled handles ignore everything.
#[derive(Clone, Default)]
pub struct Span {
    inner: Option<(Arc<Mutex<Arena>>, usize)>,
}

impl Span {
    pub fn disabled() -> Self {
        Self { inner: None }
    }

    /// A new root span (the `request.pipeline` unit).
    pub fn root(key: &str, kind: &str) -> Self {
        let arena = Arc::new(Mutex::new(Arena::default()));
        arena.lock().unwrap().nodes.push(SpanNode {
            key: key.into(),
            kind: kind.into(),
            started_at_ms: now_ms(),
            ..Default::default()
        });
        Self { inner: Some((arena, 0)) }
    }

    pub fn enabled(&self) -> bool {
        self.inner.is_some()
    }

    /// Opens a child span, recording its start fields.
    pub fn child(&self, key: impl Into<String>, kind: &str, begin: impl FnOnce() -> Map) -> Span {
        let Some((arena, parent)) = &self.inner else { return Span::disabled() };
        let begin_fields = begin();
        let mut a = arena.lock().unwrap();
        let index = a.nodes.len();
        a.nodes.push(SpanNode {
            key: key.into(),
            kind: kind.into(),
            begin_fields,
            started_at_ms: now_ms(),
            ..Default::default()
        });
        a.nodes[*parent].children.push(index);
        Span { inner: Some((arena.clone(), index)) }
    }

    /// Opens a child span with no start fields.
    pub fn open(&self, key: impl Into<String>, kind: &str) -> Span {
        self.child(key, kind, Map::new)
    }

    /// Marks the span complete, recording its finish fields.
    pub fn complete(&self, fields: impl FnOnce() -> Map) {
        let Some((arena, index)) = &self.inner else { return };
        let fields = fields();
        let mut a = arena.lock().unwrap();
        let node = &mut a.nodes[*index];
        node.complete_fields = fields;
        node.completed = true;
        node.completed_at_ms = Some(now_ms());
    }

    /// Completes the span with no finish fields.
    pub fn done(&self) {
        self.complete(Map::new);
    }

    /// Adds a finish field resolved at projection time (see [`LateField`]).
    pub fn late_field(&self, name: &str, field: LateField) {
        let Some((arena, index)) = &self.inner else { return };
        arena.lock().unwrap().nodes[*index].late_fields.push((name.into(), field));
    }

    /// `omitFromTrace`: the span (and its subtree) is dropped from the serialised trace.
    pub fn omit(&self) {
        let Some((arena, index)) = &self.inner else { return };
        arena.lock().unwrap().nodes[*index].omit = true;
    }

    /// Runs `f` with read access to the tree; `None` when disabled.
    fn with_tree<R>(&self, f: impl FnOnce(&Arena, usize) -> R) -> Option<R> {
        let (arena, index) = self.inner.as_ref()?;
        let a = arena.lock().unwrap();
        Some(f(&a, *index))
    }
}

/// Builds a field map from `(name, value)` pairs.
pub fn fields<const N: usize>(pairs: [(&str, Value); N]) -> Map {
    pairs.into_iter().map(|(k, v)| (Arc::from(k), v)).collect()
}

/// Values for [`LateField`]s at projection time.
pub struct LateValues {
    pub answers: Value,
}

fn timing(map: &mut Map, node: &SpanNode) {
    map.insert("startedAtMs".into(), Value::Number(node.started_at_ms));
    if let Some(end) = node.completed_at_ms {
        map.insert("completedAtMs".into(), Value::Number(end));
        map.insert("durationMs".into(), Value::Number(end - node.started_at_ms));
    }
}

/// `TraceSpanSerializer.serialize`. Self time is the span's duration minus its children's (TS
/// measures the synchronous handler slices instead); execution slices are the stretches before the
/// first child and after the last.
fn serialize(arena: &Arena, index: usize, late: &LateValues) -> Value {
    let node = &arena.nodes[index];
    let mut complete = node.complete_fields.clone();
    for (name, field) in &node.late_fields {
        let value = match field {
            LateField::Answers => late.answers.clone(),
        };
        complete.insert(name.as_str().into(), value);
    }
    let mut map = Map::new();
    map.insert("key".into(), Value::from(node.key.as_str()));
    map.insert("kind".into(), Value::from(node.kind.as_str()));
    map.insert("beginFields".into(), Value::object(node.begin_fields.clone()));
    map.insert("completeFields".into(), Value::object(complete));
    map.insert("completed".into(), Value::Bool(node.completed));
    timing(&mut map, node);
    let children: Vec<usize> = node.children.iter().copied().filter(|c| !arena.nodes[*c].omit).collect();
    let end = node.completed_at_ms.unwrap_or_else(now_ms);
    let child_time: f64 = node
        .children
        .iter()
        .map(|c| &arena.nodes[*c])
        .map(|c| c.completed_at_ms.unwrap_or(end) - c.started_at_ms)
        .sum();
    map.insert("selfDurationMs".into(), Value::Number((end - node.started_at_ms - child_time).max(0.0)));
    let slice = |s: f64, e: f64| Value::from_pairs([("startedAtMs", Value::Number(s)), ("completedAtMs", Value::Number(e))]);
    let mut slices = Vec::new();
    match (node.children.first(), node.children.last()) {
        (Some(first), Some(last)) => {
            slices.push(slice(node.started_at_ms, arena.nodes[*first].started_at_ms));
            if node.completed {
                slices.push(slice(arena.nodes[*last].completed_at_ms.unwrap_or(end), end));
            }
        }
        _ => slices.push(slice(node.started_at_ms, end)),
    }
    map.insert("executionSlices".into(), Value::array(slices));
    map.insert(
        "children".into(),
        Value::array(children.into_iter().map(|c| serialize(arena, c, late)).collect()),
    );
    Value::object(map)
}

/// A finished request trace (`RequestTraceEvent`), JS-shaped: `{ snapshot, trace, route? }`.
#[derive(Clone, Debug)]
pub struct RequestTraceEvent(pub Value);

impl RequestTraceEvent {
    pub fn value(&self) -> &Value {
        &self.0
    }

    pub fn snapshot(&self) -> Value {
        self.0.get("snapshot")
    }

    pub fn trace(&self) -> Value {
        self.0.get("trace")
    }

    pub fn route(&self) -> Value {
        self.0.get("route")
    }

    pub fn to_json(&self) -> serde_json::Value {
        self.0.to_json()
    }
}

/// A finished compilation trace (`CompilationTraceEvent`), JS-shaped: `{ journeyCode?, trace }`.
#[derive(Clone, Debug)]
pub struct CompilationTraceEvent(pub Value);

impl CompilationTraceEvent {
    pub fn journey_code(&self) -> Option<String> {
        self.0.get("journeyCode").as_str().map(str::to_string)
    }

    pub fn trace(&self) -> Value {
        self.0.get("trace")
    }

    pub fn to_json(&self) -> serde_json::Value {
        self.0.to_json()
    }
}

/// `CompilationPipelineTraceProjector.emit`: `None` when no phase started. A failed compilation
/// leaves the root incomplete; it is closed here so the trace carries a duration either way.
pub fn project_compilation(root: &Span, journey_code: Option<&str>, error: Option<&str>) -> Option<CompilationTraceEvent> {
    if root.with_tree(|a, i| a.nodes[i].children.is_empty()).unwrap_or(true) {
        return None;
    }
    if root.with_tree(|a, i| !a.nodes[i].completed).unwrap_or(false) {
        root.done();
    }
    root.with_tree(|arena, index| {
        let root_node = &arena.nodes[index];
        let late = LateValues { answers: Value::Undefined };
        let phases: Vec<Value> = root_node
            .children
            .iter()
            .map(|phase_index| {
                let phase = &arena.nodes[*phase_index];
                let name = phase.kind.strip_prefix("compilation.").unwrap_or(&phase.kind).to_string();
                let units = phase
                    .children
                    .iter()
                    .filter(|c| !arena.nodes[**c].omit)
                    .map(|c| serialize(arena, *c, &late))
                    .collect();
                let mut map = Map::new();
                map.insert("phase".into(), Value::from(name));
                timing(&mut map, phase);
                map.insert("units".into(), Value::array(units));
                Value::object(map)
            })
            .collect();
        let mut trace = Map::new();
        trace.insert("outcome".into(), Value::from(if error.is_some() { "error" } else { "compiled" }));
        timing(&mut trace, root_node);
        if let Some(message) = error {
            trace.insert("error".into(), Value::from_pairs([("message", Value::from(message))]));
        }
        trace.insert("phases".into(), Value::array(phases));
        let mut event = Map::new();
        event.insert("journeyCode".into(), journey_code.map(Value::from).unwrap_or_default());
        event.insert("trace".into(), Value::object(trace));
        CompilationTraceEvent(Value::object(event))
    })
}

/// The phase-level view the projector needs.
pub struct PhaseSnapshot {
    /// Index of the phase span under the root.
    pub phase_index: usize,
    /// `ContextSnapshotData` captured when the phase completed (or when it failed).
    pub data: Value,
}

/// The result detail for a trace (`outcome`, `redirect` / `error`).
pub enum TraceResult {
    Render,
    Redirect(String),
    /// A phase halted with an error status.
    HaltError { status: u16, message: String },
    /// The pipeline failed (an exception in TS).
    Failed { status: Option<u16>, message: String, stack: Option<String> },
}

/// Inputs for [`project`].
pub struct Projection<'a> {
    pub snapshot: Value,
    pub root: &'a Span,
    /// Context snapshots keyed by phase index, for phases that completed (plus the failed phase).
    pub phase_snapshots: &'a [PhaseSnapshot],
    pub result: TraceResult,
    pub reachability: Option<Value>,
    pub route: Value,
    pub late: LateValues,
}

/// `RequestPipelineTraceProjector.emit` / `emitFailed`: `None` when there were no phases.
pub fn project(p: Projection<'_>) -> Option<RequestTraceEvent> {
    p.root.with_tree(|arena, root| {
        let root_node = &arena.nodes[root];
        let phases: Vec<Value> = root_node
            .children
            .iter()
            .enumerate()
            .map(|(i, phase_index)| {
                let phase = &arena.nodes[*phase_index];
                let name = phase.kind.strip_prefix("request.").unwrap_or(&phase.kind).to_string();
                let mut units: Vec<Value> = phase.children.iter().map(|c| serialize(arena, *c, &p.late)).collect();
                if let Some(snapshot) = p.phase_snapshots.iter().find(|s| s.phase_index == i) {
                    units.push(context_snapshot_unit(&name, &snapshot.data));
                }
                let mut map = Map::new();
                map.insert("phase".into(), Value::from(name));
                timing(&mut map, phase);
                map.insert("units".into(), Value::array(units));
                Value::object(map)
            })
            .collect();
        if phases.is_empty() {
            return None;
        }
        let mut trace = Map::new();
        let outcome = match &p.result {
            TraceResult::Render => "render",
            TraceResult::Redirect(_) => "redirect",
            TraceResult::HaltError { .. } | TraceResult::Failed { .. } => "error",
        };
        trace.insert("outcome".into(), Value::from(outcome));
        timing(&mut trace, root_node);
        match &p.result {
            TraceResult::Render => {}
            TraceResult::Redirect(target) => {
                trace.insert("redirect".into(), Value::from_pairs([("target", Value::from(target.as_str()))]));
            }
            TraceResult::HaltError { status, message } => {
                trace.insert(
                    "error".into(),
                    Value::from_pairs([("status", Value::from(*status as f64)), ("message", Value::from(message.as_str()))]),
                );
            }
            TraceResult::Failed { status, message, stack } => {
                let mut error = Map::new();
                error.insert("message".into(), Value::from(message.as_str()));
                error.insert("stack".into(), stack.as_deref().map(Value::from).unwrap_or_default());
                if let Some(status) = status {
                    error.insert("status".into(), Value::from(*status as f64));
                }
                trace.insert("error".into(), Value::object(error));
            }
        }
        if let Some(r) = &p.reachability {
            trace.insert("reachability".into(), r.clone());
        }
        trace.insert("phases".into(), Value::array(phases));
        let mut event = Map::new();
        event.insert("snapshot".into(), p.snapshot.clone());
        event.insert("trace".into(), Value::object(trace));
        event.insert("route".into(), p.route.clone());
        Some(RequestTraceEvent(Value::object(event)))
    })?
}

fn context_snapshot_unit(phase: &str, data: &Value) -> Value {
    let mut map = Map::new();
    map.insert("key".into(), Value::from(format!("after-{phase}")));
    map.insert("kind".into(), Value::from("context-snapshot"));
    map.insert("beginFields".into(), Value::empty_object());
    map.insert("completeFields".into(), Value::empty_object());
    map.insert("completed".into(), Value::Bool(true));
    map.insert("children".into(), Value::array(vec![]));
    for key in ["answers", "data", "reachabilityValidities", "reachability"] {
        map.insert(key.into(), data.get(key));
    }
    Value::object(map)
}

/// Number of phase spans opened under `root` so far.
pub fn phase_count(root: &Span) -> usize {
    root.with_tree(|a, i| a.nodes[i].children.len()).unwrap_or(0)
}

// ---------------------------------------------------------------------------------------------
// JS-shaped views of runtime state for traces.

use crate::engine::concerns::reachability::{
    JourneyReachabilityProjection, ReachabilityEvaluation, ResumeOutcome, StepReachabilityProjection, UnreachableRedirect,
};
use crate::engine::concerns::validation::{StepValidity, ValidationResult};
use crate::engine::runtime::context::RuntimeContext;

/// The request snapshot as TS carries it on the trace event.
pub fn snapshot_value(snapshot: &RequestSnapshot) -> Value {
    Value::from_pairs([
        ("nodeId", Value::String(snapshot.node_id.clone())),
        ("method", Value::from(snapshot.method.as_str())),
        ("location", snapshot.location.to_value()),
        ("params", snapshot.params.clone()),
        ("query", snapshot.query.clone()),
        ("post", snapshot.post.clone()),
        ("headers", snapshot.headers.clone()),
        ("cookies", snapshot.cookies.clone()),
        ("state", snapshot.state.clone()),
        ("session", snapshot.session.clone()),
    ])
}

/// `captureContextSnapshot` (`ContextSnapshotData`). Values are immutable and shared, so no deep
/// copy is needed to freeze them.
pub fn capture_context_snapshot(ctx: &RuntimeContext) -> Value {
    let validities = ctx
        .evaluation
        .reachability_validities
        .as_ref()
        .map(|v| Value::object(v.iter().map(|(id, validity)| (id.clone(), step_validity_value(validity))).collect()));
    Value::from_pairs([
        ("answers", ctx.answers_value()),
        ("data", Value::object(ctx.domain.data.clone())),
        ("reachabilityValidities", validities.unwrap_or_default()),
        ("reachability", ctx.evaluation.reachability.as_deref().map(projection_value).unwrap_or_default()),
    ])
}

/// `StepValidityResult`.
pub fn step_validity_value(v: &StepValidity) -> Value {
    Value::from_pairs([
        ("fieldFailures", Value::array(v.field_failures.iter().map(failure_value).collect())),
        ("domainFailures", Value::array(v.domain_failures.iter().map(failure_value).collect())),
    ])
}

fn failure_value(f: &ValidationResult) -> Value {
    let mut map = Map::new();
    map.insert("passed".into(), Value::Bool(f.passed));
    map.insert("message".into(), f.message.clone());
    map.insert("submissionOnly".into(), Value::Bool(f.submission_only));
    map.insert("groups".into(), f.groups.clone());
    map.insert("details".into(), f.details.clone());
    map.insert("blockCode".into(), f.block_code.clone().unwrap_or_default());
    if let Some(id) = &f.block_id {
        map.insert("blockId".into(), Value::String(id.clone()));
    }
    Value::object(map)
}

fn projection_value(p: &JourneyReachabilityProjection) -> Value {
    let steps = |s: &[StepReachabilityProjection]| Value::array(s.iter().map(step_projection_value).collect());
    Value::from_pairs([("reachableSteps", steps(&p.reachable_steps)), ("unreachableSteps", steps(&p.unreachable_steps))])
}

fn strings(v: &[String]) -> Value {
    Value::array(v.iter().map(|s| Value::from(s.as_str())).collect())
}

fn opt_str(v: &Option<String>) -> Value {
    v.as_deref().map(Value::from).unwrap_or_default()
}

fn step_projection_value(s: &StepReachabilityProjection) -> Value {
    Value::from_pairs([
        ("path", Value::from(s.path.as_str())),
        ("code", opt_str(&s.code)),
        // `ReachabilityStateProjector.projectStep` sets these only when non-empty.
        ("fieldCodes", if s.field_codes.is_empty() { Value::Undefined } else { strings(&s.field_codes) }),
        (
            "cleardownFieldCodes",
            if s.cleardown_field_codes.is_empty() { Value::Undefined } else { strings(&s.cleardown_field_codes) },
        ),
        ("backPath", opt_str(&s.back_path)),
    ])
}

/// `RequestTraceReachability` (`reachabilityDetail`).
pub fn reachability_value(e: &ReachabilityEvaluation) -> Value {
    let steps = e
        .steps
        .iter()
        .map(|s| {
            let mut map = Map::new();
            map.insert("stepId".into(), Value::String(s.step_id.clone()));
            map.insert("routeTemplatePath".into(), Value::from(s.route_template_path.as_str()));
            map.insert("code".into(), opt_str(&s.code));
            map.insert("declarationIndex".into(), Value::from(s.declaration_index));
            map.insert("isEntryPoint".into(), Value::Bool(s.is_entry_point));
            map.insert("isConditionalEntry".into(), Value::Bool(s.is_conditional_entry));
            map.insert("hasValidation".into(), Value::Bool(s.has_validation));
            map.insert("isReachable".into(), Value::Bool(s.is_reachable));
            map.insert("isValid".into(), Value::Bool(s.is_valid));
            map.insert("forwardRouteTemplatePaths".into(), strings(&s.forward_route_template_paths));
            map.insert("declaredForwardRouteTemplatePaths".into(), strings(&s.declared_forward_route_template_paths));
            map.insert("predecessorRouteTemplatePaths".into(), strings(&s.predecessor_route_template_paths));
            map.insert("tieBreakerPriority".into(), s.tie_breaker_priority.map(Value::Number).unwrap_or_default());
            Value::object(map)
        })
        .collect();
    Value::from_pairs([
        ("currentStepId", e.current_step_id.as_ref().map(|id| Value::String(id.clone())).unwrap_or_default()),
        ("steps", Value::array(steps)),
        ("defaultEntryRouteTemplatePath", opt_str(&e.default_entry_route_template_path)),
        ("frontierRouteTemplatePath", opt_str(&e.frontier_route_template_path)),
        ("canonicalPathRouteTemplatePaths", strings(&e.canonical_path_route_template_paths)),
        ("progressExists", Value::Bool(e.progress_exists)),
        ("resumeActive", Value::Bool(e.resume_active)),
        (
            "resumeOutcome",
            Value::from(match e.resume_outcome {
                ResumeOutcome::NoOp => "no-op",
                ResumeOutcome::Redirect => "redirect",
            }),
        ),
        (
            "unreachableRedirect",
            Value::from(match e.unreachable_redirect {
                UnreachableRedirect::Entry => "entry",
                UnreachableRedirect::Frontier => "frontier",
            }),
        ),
    ])
}
