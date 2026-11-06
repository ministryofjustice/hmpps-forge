//! Resolve (port of `concerns/resolve` plus the field helpers of
//! `generatedFunctionRuntimeLibrary`): builds the step's `RenderContext` - blocks with resolved
//! properties, field values and failures, the effective view, ancestors and backlink.

use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};

use futures::future::BoxFuture;
use futures::FutureExt;

use crate::engine::ast::{ExprKind, Node, NodeId, NodeKind, Prop};
use crate::engine::concerns::validation::ValidationResult;
use crate::engine::errors::ForgeResult;
use crate::engine::expr::{instance_id, ExprCompiler, Expr, ItemLoop, Scope};
use crate::engine::registries::ComponentRegistry;
use crate::engine::runtime::context::{AnswerHistory, SharedContext};
use crate::engine::value_expr::{BlockHandler, BlockValue, ErrorMode, ValueExpr, ValuePolicy};
use crate::value::{Map, OpaqueValue, Value};

const BLOCK_SKIP_PROPS: &[&str] = &["formatters", "parsers", "validWhen", "dependentWhen"];
const STEP_SKIP_PROPS: &[&str] = &["onAccess", "onSubmission", "blocks", "reachability"];
const JOURNEY_SKIP_PROPS: &[&str] = &["onAccess", "children", "steps", "reachability"];

/// A resolved block (`RenderBlock`). Opaque so render can recognise nested blocks inside
/// arbitrary properties, the way TS recognises the render-block brand.
#[derive(Clone, Debug)]
pub struct RenderBlock {
    pub id: Arc<str>,
    pub variant: Arc<str>,
    pub block_type: &'static str,
    pub properties: Value,
}

impl OpaqueValue for RenderBlock {
    fn view(&self) -> Value {
        Value::from_pairs([
            ("id", Value::String(self.id.clone())),
            ("variant", Value::String(self.variant.clone())),
            ("blockType", Value::from(self.block_type)),
            ("properties", self.properties.clone()),
        ])
    }

    fn as_any(&self) -> &dyn std::any::Any {
        self
    }
}

type Props = Vec<(Arc<str>, ValueExpr)>;

/// What resolving one block needs (`BlockPropsCompilation`).
struct BlockPlan {
    node: Arc<Node>,
    field: bool,
    props: Props,
    resolves_field_value: bool,
    /// The field code as written (`code` prop), for field blocks.
    code: Option<Prop>,
}

struct Ancestor {
    props: Props,
    composed_path: Option<String>,
}

/// The compiled resolve for one step (`CompiledResolveFunction`).
pub struct CompiledResolve {
    step: Props,
    ancestors: Vec<Ancestor>,
    blocks: Vec<BlockPlan>,
    standalone_iterates: Vec<(Expr, Vec<BlockPlan>)>,
    exprs_code: HashMap<NodeId, Expr>,
}

fn classify_props(exprs: &ExprCompiler<'_>, node: &Node, skip: &[&str]) -> ForgeResult<Props> {
    node.props
        .iter()
        .filter(|(k, _)| !skip.contains(&k.as_ref()))
        .map(|(k, v)| Ok((k.clone(), prune(exprs.value(v)?))))
        .collect()
}

/// `pruneNestedBlockProps`: nested blocks drop their non-render properties.
fn prune(value: ValueExpr) -> ValueExpr {
    match value {
        ValueExpr::Block(b) => ValueExpr::Block(Arc::new(BlockValue {
            node: b.node.clone(),
            entries: b
                .entries
                .iter()
                .filter(|(k, _)| !BLOCK_SKIP_PROPS.contains(&k.as_ref()))
                .map(|(k, v)| (k.clone(), prune(v.clone())))
                .collect(),
        })),
        ValueExpr::Record(entries) => ValueExpr::Record(entries.into_iter().map(|(k, v)| (k, prune(v))).collect()),
        ValueExpr::List(items) => ValueExpr::List(items.into_iter().map(prune).collect()),
        ValueExpr::Conditional { predicate, then, otherwise } => {
            ValueExpr::Conditional { predicate, then: Box::new(prune(*then)), otherwise: Box::new(prune(*otherwise)) }
        }
        ValueExpr::Match { subject, arms, otherwise } => ValueExpr::Match {
            subject: Box::new(prune(*subject)),
            arms: arms.into_iter().map(|(a, v)| (a, prune(v))).collect(),
            otherwise: otherwise.map(|o| Box::new(prune(*o))),
        },
        ValueExpr::Map { input, yield_ } => ValueExpr::Map { input, yield_: yield_.map(|y| Box::new(prune(*y))) },
        other => other,
    }
}

/// IDs of iterate nodes reached through authored-value classification (`collectInlineIterateIds`).
fn collect_inline_iterates(prop: &Prop, ids: &mut HashSet<NodeId>) {
    if prop.is_static() {
        return;
    }
    match prop {
        Prop::Lit(_) => {}
        Prop::Array(items) => items.iter().for_each(|p| collect_inline_iterates(p, ids)),
        Prop::Object(o) => o.values().for_each(|p| collect_inline_iterates(p, ids)),
        Prop::Node(node) => match &node.kind {
            NodeKind::Block { .. } => node.props.values().for_each(|p| collect_inline_iterates(p, ids)),
            NodeKind::Expr(ExprKind::Conditional) => {
                for key in ["predicate", "thenValue", "elseValue"] {
                    if let Some(p) = node.prop(key) {
                        collect_inline_iterates(p, ids);
                    }
                }
            }
            NodeKind::Expr(ExprKind::Match) => {
                for key in ["subject", "branches", "otherwise"] {
                    if let Some(p) = node.prop(key) {
                        collect_inline_iterates(p, ids);
                    }
                }
            }
            NodeKind::Expr(ExprKind::Iterate) => {
                ids.insert(node.id.clone());
                if let Some(p) = node.prop("input") {
                    collect_inline_iterates(p, ids);
                }
                if let Some(it) = node.prop("iterator").and_then(Prop::as_object) {
                    for key in ["yieldTemplate", "predicateTemplate"] {
                        if let Some(p) = it.get(key) {
                            collect_inline_iterates(p, ids);
                        }
                    }
                }
            }
            _ => {}
        },
    }
}

fn find_template_blocks(prop: &Prop, out: &mut Vec<Arc<Node>>) {
    match prop {
        Prop::Lit(_) => {}
        Prop::Array(items) => items.iter().for_each(|p| find_template_blocks(p, out)),
        Prop::Object(o) => o.values().for_each(|p| find_template_blocks(p, out)),
        Prop::Node(n) if n.is_block() => out.push(n.clone()),
        Prop::Node(n) => n.props.values().for_each(|p| find_template_blocks(p, out)),
    }
}

fn block_plan(exprs: &ExprCompiler<'_>, node: &Arc<Node>) -> ForgeResult<BlockPlan> {
    let field = node.is_field_block();
    Ok(BlockPlan {
        node: node.clone(),
        field,
        props: classify_props(exprs, node, BLOCK_SKIP_PROPS)?,
        resolves_field_value: field && node.prop("value").is_none_or(Prop::is_undefined),
        code: node.prop("code").cloned(),
    })
}

fn compose_path(running: &str, own: &str) -> String {
    format!("/{}", format!("{running}/{own}").split('/').filter(|s| !s.is_empty()).collect::<Vec<_>>().join("/"))
}

impl CompiledResolve {
    /// `ResolveAnalyzer.analyzeStep` + `StepResolveCompiler.compile`.
    pub fn compile(
        step: &Arc<Node>,
        ancestor_journeys_root_first: &[Arc<Node>],
        step_iterates: &[Arc<Node>],
        exprs: &ExprCompiler<'_>,
    ) -> ForgeResult<Self> {
        let step_props = classify_props(exprs, step, STEP_SKIP_PROPS)?;
        let mut running: Option<String> = Some(String::new());
        let mut ancestors = Vec::new();
        for journey in ancestor_journeys_root_first {
            let props = classify_props(exprs, journey, JOURNEY_SKIP_PROPS)?;
            running = match (&running, journey.str_prop("path")) {
                (Some(r), Some(own)) => Some(compose_path(r, own)),
                _ => None,
            };
            ancestors.push(Ancestor { props, composed_path: running.clone() });
        }
        let blocks = step.children("blocks").iter().map(|b| block_plan(exprs, b)).collect::<ForgeResult<Vec<_>>>()?;

        let mut inline = HashSet::new();
        for key in step.props.keys().filter(|k| !STEP_SKIP_PROPS.contains(&k.as_ref())) {
            collect_inline_iterates(&step.props[key], &mut inline);
        }
        for journey in ancestor_journeys_root_first {
            for (k, v) in &journey.props {
                if !JOURNEY_SKIP_PROPS.contains(&k.as_ref()) {
                    collect_inline_iterates(v, &mut inline);
                }
            }
        }
        for block in step.children("blocks") {
            for (k, v) in &block.props {
                if !BLOCK_SKIP_PROPS.contains(&k.as_ref()) {
                    collect_inline_iterates(v, &mut inline);
                }
            }
        }
        let mut standalone_iterates = Vec::new();
        let mut exprs_code = HashMap::new();
        for it in step_iterates {
            if inline.contains(&it.id) || crate::engine::analysis::iterator_type(it) != Some("IteratorType.Map") {
                continue;
            }
            let Some(template) = it.prop("iterator").and_then(Prop::as_object).and_then(|i| i.get("yieldTemplate")) else {
                continue;
            };
            let mut template_blocks = Vec::new();
            find_template_blocks(template, &mut template_blocks);
            if template_blocks.is_empty() {
                continue;
            }
            let plans = template_blocks.iter().map(|b| block_plan(exprs, b)).collect::<ForgeResult<Vec<_>>>()?;
            for b in &template_blocks {
                if let Some(Prop::Node(code)) = b.prop("code") {
                    exprs_code.insert(b.id.clone(), exprs.node(code)?);
                }
            }
            standalone_iterates.push((exprs.operand_opt(it.prop("input"))?, plans));
        }
        Ok(Self { step: step_props, ancestors, blocks, standalone_iterates, exprs_code })
    }

    /// Runs resolve and returns `(blocks, step, ancestors)` (`ResolveBlocksOutput`).
    pub async fn run(&self, env: Arc<ResolveEnv>) -> ForgeResult<(Vec<Value>, Value, Vec<Value>)> {
        let handler: Arc<dyn BlockHandler> = env.clone();
        let policy = ValuePolicy {
            mode: ErrorMode::Throw,
            fallback: Value::Undefined,
            omit_undefined_array_items: true,
            blocks: Some(handler),
        };
        let mut scope = Scope::new(env.ctx.clone());

        // Static properties first, then dynamic ones (assignment order of the generated code).
        let step = eval_props_static_first(&self.step, &mut scope, &policy).await?;

        let mut ancestors = Vec::new();
        let all_composed = self.ancestors.iter().all(|a| a.composed_path.is_some());
        let mut composed = String::new();
        for a in &self.ancestors {
            let mut value = eval_props_static_first(&a.props, &mut scope, &policy).await?;
            let path = if all_composed {
                a.composed_path.clone().unwrap_or_default()
            } else {
                composed = compose_path(&composed, &value.get("path").to_js_string());
                composed.clone()
            };
            value.set("path", Value::from(path));
            ancestors.push(value);
        }

        let mut blocks = Vec::new();
        for plan in &self.blocks {
            blocks.push(env.resolve_block(plan, &mut scope, &policy, None).await?);
        }
        for (input, plans) in &self.standalone_iterates {
            let input = input.eval(&mut scope).await?;
            let mut items = ItemLoop::new(input);
            while items.next(&mut scope)?.is_some() {
                for plan in plans {
                    let code = match self.exprs_code.get(&plan.node.id) {
                        Some(e) => Some(Value::from(e.eval(&mut scope).await?.to_js_string())),
                        None => plan.code.as_ref().and_then(Prop::as_str).map(Value::from),
                    };
                    blocks.push(env.resolve_block(plan, &mut scope, &policy, code).await?);
                }
            }
            items.finish(&mut scope);
        }
        Ok((blocks, step, ancestors))
    }
}

async fn eval_props_static_first(props: &Props, scope: &mut Scope, policy: &ValuePolicy) -> ForgeResult<Value> {
    let mut map = Map::new();
    for (k, v) in props {
        if let ValueExpr::Static(s) = v {
            map.insert(k.clone(), s.clone());
        }
    }
    for (k, v) in props {
        if !matches!(v, ValueExpr::Static(_)) {
            let value = v.eval(scope, policy).await?;
            map.insert(k.clone(), value);
        }
    }
    Ok(Value::object(map))
}

/// Request-time inputs to resolve (`CompiledResolveContext`).
pub struct ResolveEnv {
    pub ctx: SharedContext,
    pub components: ComponentRegistry,
    /// Current-page field failures by block ID, `blockId` stripped.
    pub field_failures: HashMap<Arc<str>, Vec<ValidationResult>>,
    /// Filled during resolution: failing block ID -> error summary anchor.
    pub anchors: Mutex<HashMap<Arc<str>, String>>,
}

/// `resolvePostFieldValue`: the posted value unless a non-`processed` mutation followed it.
fn post_field_value(history: Option<&AnswerHistory>) -> Value {
    let Some(h) = history else { return Value::Undefined };
    if let Some(i) = h.mutations.iter().rposition(|m| m.source.as_ref() == "post")
        && h.mutations[i + 1..].iter().all(|m| m.source.as_ref() == "processed")
    {
        return h.mutations[i].value.clone();
    }
    h.current.clone()
}

/// `resolveGetFieldValue`.
fn get_field_value(history: Option<&AnswerHistory>, default: Value) -> Value {
    match history {
        Some(h) if !h.parsed.is_undefined() => h.parsed.clone(),
        Some(h) => h.current.clone(),
        None => default,
    }
}

impl ResolveEnv {
    fn resolve_field_value(&self, props: &mut Value) {
        let Value::String(code) = props.get("code") else { return };
        let ctx = self.ctx.lock();
        let history = ctx.domain.answers.get(code.as_ref());
        let value = if ctx.request.method == "POST" {
            post_field_value(history)
        } else {
            get_field_value(history, props.get("defaultValue"))
        };
        drop(ctx);
        props.set("value", value);
    }

    fn resolve_field_failures(&self, block_id: &Arc<str>, variant: &str, props: &mut Value) {
        if self.field_failures.is_empty() {
            return;
        }
        let failures = self.field_failures.get(block_id).cloned().unwrap_or_default();
        props.set("errors", Value::array(failures.iter().map(ValidationResult::to_value).collect()));
        if failures.is_empty() {
            return;
        }
        let anchor = self
            .components
            .get(variant)
            .and_then(|c| c.error_anchor.as_ref())
            .and_then(|f| f(props))
            .map(Value::from)
            .unwrap_or_else(|| props.get("code"));
        if let Value::String(a) = anchor {
            self.anchors.lock().unwrap().insert(block_id.clone(), a.to_string());
        }
    }

    /// Resolves one block's properties (`compileBlockProperties` + field resolution).
    fn resolve_block<'a>(
        &'a self,
        plan: &'a BlockPlan,
        scope: &'a mut Scope,
        policy: &'a ValuePolicy,
        template_code: Option<Value>,
    ) -> BoxFuture<'a, ForgeResult<Value>> {
        async move {
            let block_id: Arc<str> = instance_id(&plan.node, &scope.frame_indexes()).into();
            // Bind `Self()` to the field's code while its properties evaluate (`toSelfBoundPlan`):
            // a template code computed by the caller, a static code, or the code expression
            // evaluated once and stringified.
            let code_value = match (&template_code, plan.field, &plan.code) {
                (Some(c), _, _) => Some(c.clone()),
                (None, true, Some(Prop::Lit(Value::String(s)))) => Some(Value::String(s.clone())),
                (None, true, Some(Prop::Node(_))) => {
                    match plan.props.iter().find(|(k, _)| k.as_ref() == "code") {
                        Some((_, v)) => Some(Value::from(v.eval(scope, policy).await?.to_js_string())),
                        None => None,
                    }
                }
                _ => None,
            };
            let previous_self = scope.self_code.clone();
            if code_value.is_some() {
                scope.self_code = code_value.clone();
            }
            let result = self.resolve_props(plan, scope, policy, code_value, &block_id).await;
            scope.self_code = previous_self;
            let props = result?;
            Ok(Value::opaque(RenderBlock {
                id: block_id,
                variant: plan.node.variant().cloned().unwrap_or_default(),
                block_type: if plan.field { "BlockType.field" } else { "BlockType.basic" },
                properties: props,
            }))
        }
        .boxed()
    }

    async fn resolve_props(
        &self,
        plan: &BlockPlan,
        scope: &mut Scope,
        policy: &ValuePolicy,
        code_value: Option<Value>,
        block_id: &Arc<str>,
    ) -> ForgeResult<Value> {
        let mut props = Value::empty_object();
        let visible_when = plan.props.iter().find(|(k, _)| k.as_ref() == "visibleWhen");
        if let Some((_, vw)) = visible_when {
            props.set("visibleWhen", vw.eval(scope, policy).await?);
            if plan.field
                && plan.code.is_some()
                && let Some(code) = &code_value
            {
                props.set("code", code.clone());
            }
            if props.get("visibleWhen").strict_eq(&Value::Bool(false)) {
                return Ok(props);
            }
            for (k, v) in &plan.props {
                if k.as_ref() == "visibleWhen" || (plan.field && k.as_ref() == "code") {
                    continue;
                }
                props.set(k.clone(), v.eval(scope, policy).await?);
            }
        } else {
            for (k, v) in &plan.props {
                if plan.field && k.as_ref() == "code" {
                    if let Some(code) = &code_value {
                        props.set("code", code.clone());
                    }
                    continue;
                }
                props.set(k.clone(), v.eval(scope, policy).await?);
            }
        }
        if plan.field {
            if plan.resolves_field_value {
                self.resolve_field_value(&mut props);
            }
            let variant = plan.node.variant().cloned().unwrap_or_default();
            self.resolve_field_failures(block_id, &variant, &mut props);
        }
        Ok(props)
    }
}

impl BlockHandler for ResolveEnv {
    fn materialize<'a>(&'a self, block: &'a Arc<BlockValue>, scope: &'a mut Scope, policy: &'a ValuePolicy) -> BoxFuture<'a, ForgeResult<Value>> {
        async move {
            let field = block.node.is_field_block();
            let value_entry = block.entries.iter().find(|(k, _)| k.as_ref() == "value");
            let plan = BlockPlan {
                node: block.node.clone(),
                field,
                props: block.entries.clone(),
                resolves_field_value: match value_entry {
                    None => true,
                    Some((_, ValueExpr::Static(v))) => v.is_undefined(),
                    Some(_) => false,
                },
                code: block.node.prop("code").cloned(),
            };
            // Nested blocks bind no template code of their own (`codeExpression: undefined`).
            self.resolve_block(&plan, scope, policy, None).await
        }
        .boxed()
    }
}

/// Merges ancestor and step views (`resolveView`).
pub fn resolve_view(ancestors: &[Value], step_view: &Value) -> Value {
    let views: Vec<Value> = ancestors
        .iter()
        .map(|a| a.get("view"))
        .chain(std::iter::once(step_view.clone()))
        .filter(|v| !v.is_undefined())
        .collect();
    if views.is_empty() {
        return Value::Undefined;
    }
    let template = views.iter().fold(Value::Undefined, |acc, v| match v.get("template") {
        Value::Undefined => acc,
        t => t,
    });
    let mut locals = Map::new();
    for v in &views {
        if let Value::Object(l) = v.get("locals") {
            for (k, val) in l.iter() {
                locals.insert(k.clone(), val.clone());
            }
        }
    }
    let has_locals = views.iter().any(|v| !v.get("locals").is_undefined());
    let mut out = Map::new();
    if !template.is_undefined() {
        out.insert("template".into(), template);
    }
    if has_locals {
        out.insert("locals".into(), Value::object(locals));
    }
    Value::object(out)
}
