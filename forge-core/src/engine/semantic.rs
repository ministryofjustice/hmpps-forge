//! Registration-time semantic analysis of the AST (port of `concerns/semantic-analysis`): the
//! same rules, in the same order, reporting the same messages and paths. Registered nodes are
//! checked through the AST index (parents included); iterator bodies through their template
//! nodes, each attributed to the iterate node that owns it.

use std::sync::Arc;

use crate::engine::ast::{AstIndex, ExprKind, HookKind, Node, NodeKind, Prop};
use crate::engine::dsl::{Diagnostic, aggregate};
use crate::engine::errors::ForgeResult;
use crate::engine::registries::{ComponentRegistry, FunctionRegistry};
use crate::schema::Schema;
use crate::value::Value;

struct Ctx<'a> {
    index: &'a AstIndex,
    /// `TemplateNodeIndex`: every template node with its owning (registered iterate) node.
    templates: Vec<(Arc<Node>, Arc<Node>)>,
    functions: &'a FunctionRegistry,
    components: &'a ComponentRegistry,
}

fn path_of(node: &Node) -> String {
    node.source_path.as_deref().unwrap_or("unknown").to_string()
}

fn scope_error(node: &Node, message: impl Into<String>) -> Diagnostic {
    Diagnostic::new("ForgeReferenceScopeError", message).at(path_of(node))
}

impl Ctx<'_> {
    fn registered(&self) -> impl Iterator<Item = &Arc<Node>> {
        self.index.order.iter().map(|id| &self.index.nodes[id])
    }

    fn of_kind(&self, f: impl Fn(&Node) -> bool) -> Vec<Arc<Node>> {
        self.registered().filter(|n| f(n)).cloned().collect()
    }

    fn templates_of(&self, f: impl Fn(&Node) -> bool) -> Vec<(Arc<Node>, Arc<Node>)> {
        self.templates.iter().filter(|(n, _)| f(n)).cloned().collect()
    }

    fn parent(&self, node: &Node) -> Option<&Arc<Node>> {
        self.index.parent(&node.id)
    }

    /// Ancestors of a registered node, nearest first.
    fn ancestors(&self, node: &Node) -> Vec<Arc<Node>> {
        self.index.ancestors(&node.id)
    }

    fn has_hook_ancestor(&self, node: &Node) -> bool {
        self.ancestors(node).iter().any(|a| matches!(a.kind, NodeKind::Hook(_)))
    }
}

fn is_expr(node: &Node, kind: ExprKind) -> bool {
    node.kind == NodeKind::Expr(kind)
}

fn is_function(node: &Node) -> bool {
    node.expr_kind().is_some_and(ExprKind::is_function)
}

fn contains(prop: Option<&Prop>, id: &str) -> bool {
    prop.and_then(Prop::as_array).is_some_and(|items| items.iter().any(|p| p.as_node().is_some_and(|n| &*n.id == id)))
}

fn sub(prop: Option<&Prop>, key: &str) -> Option<Prop> {
    prop.and_then(Prop::as_object).and_then(|o| o.get(key)).cloned()
}

/// The iterator templates of an iterate node (`yieldTemplate`, `predicateTemplate`).
fn iterator_templates(node: &Node) -> Vec<Prop> {
    let Some(iterator) = node.prop("iterator").and_then(Prop::as_object) else { return vec![] };
    ["yieldTemplate", "predicateTemplate"].iter().filter_map(|k| iterator.get(*k).cloned()).collect()
}

/// Template nodes in pre-order (a node, then everything below it).
fn collect_templates(prop: &Prop, owner: &Arc<Node>, out: &mut Vec<(Arc<Node>, Arc<Node>)>) {
    match prop {
        Prop::Lit(_) => {}
        Prop::Array(items) => items.iter().for_each(|p| collect_templates(p, owner, out)),
        Prop::Object(o) => o.values().for_each(|p| collect_templates(p, owner, out)),
        Prop::Node(n) => {
            if n.template {
                out.push((n.clone(), owner.clone()));
            }
            n.props.values().for_each(|p| collect_templates(p, owner, out));
        }
    }
}

fn ref_path(node: &Node) -> Vec<Value> {
    node.prop("path").and_then(Prop::as_array).map(|p| p.iter().map(|s| s.as_lit().cloned().unwrap_or(Value::Undefined)).collect()).unwrap_or_default()
}

fn level_of(v: &Value) -> Option<usize> {
    let n = match v {
        Value::Number(n) => *n,
        Value::String(s) => s.trim().parse::<f64>().unwrap_or(f64::NAN),
        _ => return None,
    };
    (n.fract() == 0.0 && n >= 0.0).then_some(n as usize)
}

fn item_errors(node: &Node, depth: usize, out: &mut Vec<Diagnostic>) {
    let path = ref_path(node);
    match level_of(path.get(1).unwrap_or(&Value::Undefined)) {
        None => out.push(scope_error(node, "Item() reference level must be a non-negative integer")),
        Some(level) if level >= depth => out.push(scope_error(
            node,
            if depth == 0 {
                "Item() can only be used inside an iterator".to_string()
            } else {
                format!("Item().parent references level {level}, but only {depth} iterator scope is available")
            },
        )),
        _ => {}
    }
}

fn loop_errors(node: &Node, depth: usize, out: &mut Vec<Diagnostic>) {
    let path = ref_path(node);
    match level_of(path.get(1).unwrap_or(&Value::Undefined)) {
        None => {
            out.push(scope_error(node, "Loop reference level must be a non-negative integer"));
            return;
        }
        Some(level) if level >= depth => out.push(scope_error(
            node,
            if depth == 0 {
                "Loop can only be used inside an iterator".to_string()
            } else {
                format!("Loop.Parent references level {level}, but only {depth} iterator scope is available")
            },
        )),
        _ => {}
    }
    const PROPS: &[&str] = &["index", "index0", "revindex", "revindex0", "first", "last", "length"];
    if !path.get(2).and_then(Value::as_str).is_some_and(|p| PROPS.contains(&p)) {
        out.push(scope_error(node, "Loop reference property must be one of index, index0, revindex, revindex0, first, last, length"));
    }
}

fn namespace(node: &Node) -> Option<String> {
    ref_path(node).first().and_then(Value::as_str).map(str::to_string)
}

/// `walkIterateTemplateReferences`: Item/Loop references at the iterator depth they sit in.
fn walk_template_refs(prop: &Prop, depth: usize, out: &mut Vec<Diagnostic>) {
    match prop {
        Prop::Lit(_) => {}
        Prop::Array(items) => items.iter().for_each(|p| walk_template_refs(p, depth, out)),
        Prop::Object(o) => o.values().for_each(|p| walk_template_refs(p, depth, out)),
        Prop::Node(n) => {
            if is_expr(n, ExprKind::Iterate) {
                if let Some(input) = n.prop("input") {
                    walk_template_refs(input, depth, out);
                }
                for t in iterator_templates(n) {
                    walk_template_refs(&t, depth + 1, out);
                }
                return;
            }
            if is_expr(n, ExprKind::Reference) {
                match namespace(n).as_deref() {
                    Some("@scope") => item_errors(n, depth, out),
                    Some("@loop") => loop_errors(n, depth, out),
                    _ => {}
                }
            }
            n.props.values().for_each(|p| walk_template_refs(p, depth, out));
        }
    }
}

fn reference_scopes(c: &Ctx, out: &mut Vec<Diagnostic>) {
    for node in c.of_kind(|n| is_expr(n, ExprKind::Reference)) {
        match namespace(&node).as_deref() {
            Some("@scope") => item_errors(&node, 0, out),
            Some("@loop") => loop_errors(&node, 0, out),
            _ => {}
        }
    }
    for node in c.of_kind(|n| is_expr(n, ExprKind::Iterate)) {
        for t in iterator_templates(&node) {
            walk_template_refs(&t, 1, out);
        }
    }
}

fn is_self_path(node: &Node) -> bool {
    let path = ref_path(node);
    path.first().and_then(Value::as_str) == Some("@self")
        || (path.first().and_then(Value::as_str) == Some("answers") && path.get(1).and_then(Value::as_str) == Some("@self"))
}

#[derive(Clone, Copy)]
struct SelfScope {
    in_field: bool,
    in_code: bool,
}

fn self_scope_at(c: &Ctx, node: &Arc<Node>) -> SelfScope {
    let mut child = node.clone();
    for ancestor in c.ancestors(node) {
        if ancestor.is_field_block() {
            let in_code = ancestor.node_prop("code").is_some_and(|code| code.id == child.id);
            return SelfScope { in_field: true, in_code };
        }
        child = ancestor;
    }
    SelfScope { in_field: false, in_code: false }
}

fn self_error(node: &Node, scope: SelfScope) -> Option<Diagnostic> {
    if !scope.in_field {
        Some(scope_error(node, "Self() reference used outside of a field block"))
    } else if scope.in_code {
        Some(scope_error(node, "Self() cannot be used within the field's code expression"))
    } else {
        None
    }
}

fn walk_self(prop: &Prop, scope: SelfScope, out: &mut Vec<Diagnostic>) {
    match prop {
        Prop::Lit(_) => {}
        Prop::Array(items) => items.iter().for_each(|p| walk_self(p, scope, out)),
        Prop::Object(o) => o.values().for_each(|p| walk_self(p, scope, out)),
        Prop::Node(n) => {
            if is_expr(n, ExprKind::Reference) && is_self_path(n) {
                out.extend(self_error(n, scope));
            }
            let field = n.is_field_block();
            for (key, p) in n.props.iter() {
                let child = if field { SelfScope { in_field: true, in_code: &**key == "code" } } else { scope };
                walk_self(p, child, out);
            }
        }
    }
}

fn self_scope(c: &Ctx, out: &mut Vec<Diagnostic>) {
    for node in c.of_kind(|n| is_expr(n, ExprKind::Reference) && is_self_path(n)) {
        out.extend(self_error(&node, self_scope_at(c, &node)));
    }
    for node in c.of_kind(|n| is_expr(n, ExprKind::Iterate)) {
        let scope = self_scope_at(c, &node);
        for t in iterator_templates(&node) {
            walk_self(&t, scope, out);
        }
    }
}

fn is_answer_path(node: &Node) -> bool {
    let path = ref_path(node);
    path.first().and_then(Value::as_str) == Some("answers") && path.get(1).and_then(Value::as_str) != Some("@self")
}

/// Whether the nearest hook ancestor is an access hook.
fn in_access_hook(c: &Ctx, node: &Node) -> bool {
    c.ancestors(node).iter().find(|a| matches!(a.kind, NodeKind::Hook(_))).is_some_and(|h| h.kind == NodeKind::Hook(HookKind::Access))
}

fn answer_scope(c: &Ctx, out: &mut Vec<Diagnostic>) {
    const MESSAGE: &str = "Answer() cannot be used in an onAccess hook: answer preparation runs after access hooks";
    for node in c.of_kind(|n| is_expr(n, ExprKind::Reference) && is_answer_path(n)) {
        if in_access_hook(c, &node) {
            out.push(scope_error(&node, MESSAGE));
        }
    }
    for (node, owner) in c.templates_of(|n| is_expr(n, ExprKind::Reference) && is_answer_path(n)) {
        if in_access_hook(c, &owner) {
            out.push(scope_error(&node, MESSAGE));
        }
    }
}

fn effect_message(node: &Node) -> String {
    format!("Effect \"{}\" can only be used inside a hook (onAccess or onSubmission)", node.str_prop("name").unwrap_or_default())
}

fn effect_scope(c: &Ctx, out: &mut Vec<Diagnostic>) {
    for node in c.of_kind(|n| is_expr(n, ExprKind::Effect)) {
        if !c.has_hook_ancestor(&node) {
            out.push(scope_error(&node, effect_message(&node)));
        }
    }
    for (node, owner) in c.templates_of(|n| is_expr(n, ExprKind::Effect)) {
        if !c.has_hook_ancestor(&owner) {
            out.push(scope_error(&node, effect_message(&node)));
        }
    }
}

const FUNCTION_KINDS: [ExprKind; 4] = [ExprKind::Condition, ExprKind::Transformer, ExprKind::Generator, ExprKind::Effect];

fn registered_functions(c: &Ctx, out: &mut Vec<Diagnostic>) {
    for kind in FUNCTION_KINDS {
        let nodes: Vec<Arc<Node>> =
            c.of_kind(|n| is_expr(n, kind)).into_iter().chain(c.templates_of(|n| is_expr(n, kind)).into_iter().map(|(n, _)| n)).collect();
        for node in nodes {
            let name = node.str_prop("name").unwrap_or_default().to_string();
            if c.functions.get(&name).is_none() {
                out.push(Diagnostic {
                    function: Some(name.clone()),
                    function_type: Some(kind.tag().into()),
                    ..Diagnostic::new("ForgeUnregisteredFunctionError", format!("Function \"{name}\" ({}) is not registered", kind.tag()))
                        .at(path_of(&node))
                });
            }
        }
    }
}

/// `tupleArity`: required count (trailing optionals lower it) and maximum (none with a rest).
fn arity(schema: &Schema) -> Option<(usize, Option<usize>)> {
    let (items, rest) = match schema {
        Schema::Tuple(items) => (items, false),
        Schema::TupleRest(items, _) => (items, true),
        _ => return None,
    };
    let trailing = items.iter().rev().take_while(|s| matches!(s, Schema::Optional(_))).count();
    Some((items.len() - trailing, (!rest).then_some(items.len())))
}

fn function_arity(c: &Ctx, out: &mut Vec<Diagnostic>) {
    for kind in FUNCTION_KINDS {
        let nodes: Vec<Arc<Node>> =
            c.of_kind(|n| is_expr(n, kind)).into_iter().chain(c.templates_of(|n| is_expr(n, kind)).into_iter().map(|(n, _)| n)).collect();
        for node in nodes {
            let name = node.str_prop("name").unwrap_or_default().to_string();
            let Some((min, max)) = c.functions.get(&name).and_then(|e| e.arguments_schema.as_ref()).and_then(arity) else { continue };
            let received = node.prop("arguments").and_then(Prop::as_array).map_or(0, <[Prop]>::len);
            if received >= min && max.is_none_or(|m| received <= m) {
                continue;
            }
            let expected = match max {
                None => format!("at least {min}"),
                Some(m) if m == min => min.to_string(),
                Some(m) => format!("between {min} and {m}"),
            };
            let noun = if expected == "1" { "argument" } else { "arguments" };
            out.push(Diagnostic {
                expected: Some(expected.clone()),
                function: Some(name.clone()),
                function_type: Some(kind.tag().into()),
                ..Diagnostic::new("ForgeFunctionArityError", format!("Function \"{name}\" expects {expected} {noun} but received {received}"))
                    .at(path_of(&node))
            });
        }
    }
}

fn registered_components(c: &Ctx, out: &mut Vec<Diagnostic>) {
    let blocks: Vec<Arc<Node>> =
        c.of_kind(Node::is_block).into_iter().chain(c.templates_of(Node::is_block).into_iter().map(|(n, _)| n)).collect();
    for node in blocks {
        let variant = node.variant().map(|v| v.to_string()).unwrap_or_default();
        if c.components.get(&variant).is_none() {
            out.push(Diagnostic {
                variant: Some(variant.clone()),
                ..Diagnostic::new("ForgeUnregisteredComponentError", format!("Component variant \"{variant}\" is not registered")).at(path_of(&node))
            });
        }
    }
}

fn valid_when_ids(node: &Node) -> Vec<Arc<str>> {
    match node.prop("validWhen") {
        Some(Prop::Array(items)) => items.iter().filter_map(|p| p.as_node().map(|n| n.id.clone())).collect(),
        Some(Prop::Node(n)) => vec![n.id.clone()],
        _ => vec![],
    }
}

fn walk_validation(prop: &Prop, inside: bool, out: &mut Vec<Diagnostic>) {
    const MESSAGE: &str = "Validation rules can only be used inside validWhen on a field block or step";
    match prop {
        Prop::Lit(_) => {}
        Prop::Array(items) => items.iter().for_each(|p| walk_validation(p, inside, out)),
        Prop::Object(o) => o.values().for_each(|p| walk_validation(p, inside, out)),
        Prop::Node(n) => {
            if is_expr(n, ExprKind::Validation) && !inside {
                out.push(scope_error(n, MESSAGE));
            }
            let can_have = n.is_field_block() || n.kind == NodeKind::Step;
            for (key, p) in n.props.iter() {
                walk_validation(p, can_have && &**key == "validWhen", out);
            }
        }
    }
}

fn validation_scope(c: &Ctx, out: &mut Vec<Diagnostic>) {
    let mut ids = std::collections::HashSet::new();
    for node in c.of_kind(|n| n.is_field_block()) {
        ids.extend(valid_when_ids(&node));
    }
    for node in c.of_kind(|n| n.kind == NodeKind::Step) {
        ids.extend(valid_when_ids(&node));
    }
    for node in c.of_kind(|n| is_expr(n, ExprKind::Validation)) {
        if !ids.contains(&node.id) {
            out.push(scope_error(&node, "Validation rules can only be used inside validWhen on a field block or step"));
        }
    }
    for node in c.of_kind(|n| is_expr(n, ExprKind::Iterate)) {
        let inside = ids.contains(&node.id) || c.ancestors(&node).iter().any(|a| ids.contains(&a.id));
        for t in iterator_templates(&node) {
            walk_validation(&t, inside, out);
        }
    }
}

fn outcome_scope(c: &Ctx, out: &mut Vec<Diagnostic>) {
    const MESSAGE: &str = "Outcomes can only be used inside a hook (onAccess or onSubmission)";
    for node in c.of_kind(|n| matches!(n.kind, NodeKind::Outcome(_))) {
        let Some(parent) = c.parent(&node).filter(|p| matches!(p.kind, NodeKind::Hook(_))) else {
            out.push(scope_error(&node, MESSAGE));
            continue;
        };
        let in_next = contains(parent.prop("next"), &node.id)
            || ["onAlways", "onValid", "onInvalid"].iter().any(|k| contains(sub(parent.prop(k), "next").as_ref(), &node.id));
        if !in_next {
            out.push(scope_error(&node, MESSAGE));
        }
    }
    for (node, owner) in c.templates_of(|n| matches!(n.kind, NodeKind::Outcome(_))) {
        if !c.has_hook_ancestor(&owner) {
            out.push(scope_error(&node, MESSAGE));
        }
    }
}

fn hook_scope(c: &Ctx, out: &mut Vec<Diagnostic>) {
    const MESSAGE: &str = "Hooks can only be defined in onAccess (steps, journeys) or onSubmission (steps) arrays";
    for node in c.of_kind(|n| matches!(n.kind, NodeKind::Hook(_))) {
        let Some(parent) = c.parent(&node).filter(|p| matches!(p.kind, NodeKind::Journey | NodeKind::Step)) else {
            out.push(scope_error(&node, MESSAGE));
            continue;
        };
        let in_access = contains(parent.prop("onAccess"), &node.id);
        let in_submission = parent.kind == NodeKind::Step && contains(parent.prop("onSubmission"), &node.id);
        if !in_access && !in_submission {
            out.push(scope_error(&node, MESSAGE));
        }
    }
    for (node, _) in c.templates_of(|n| matches!(n.kind, NodeKind::Hook(_))) {
        out.push(scope_error(&node, MESSAGE));
    }
}

fn tie_breaker_scope(c: &Ctx, out: &mut Vec<Diagnostic>) {
    const MESSAGE: &str = "Tie-breakers can only be used in a step's reachability configuration";
    for node in c.of_kind(|n| is_expr(n, ExprKind::TieBreaker)) {
        let ok = c
            .parent(&node)
            .filter(|p| p.kind == NodeKind::Step)
            .is_some_and(|p| contains(sub(p.prop("reachability"), "tieBreakers").as_ref(), &node.id));
        if !ok {
            out.push(scope_error(&node, MESSAGE));
        }
    }
    for (node, _) in c.templates_of(|n| is_expr(n, ExprKind::TieBreaker)) {
        out.push(scope_error(&node, MESSAGE));
    }
}

fn structure_scope(c: &Ctx, out: &mut Vec<Diagnostic>) {
    const STEP: &str = "Steps can only be defined in a journey steps array";
    const JOURNEY: &str = "Journeys can only be defined at the root or in a journey children array";
    for node in c.of_kind(|n| n.kind == NodeKind::Step) {
        let ok = c.parent(&node).filter(|p| p.kind == NodeKind::Journey).is_some_and(|p| contains(p.prop("steps"), &node.id));
        if !ok {
            out.push(scope_error(&node, STEP));
        }
    }
    for node in c.of_kind(|n| n.kind == NodeKind::Journey) {
        let Some(parent) = c.parent(&node) else { continue };
        if parent.kind != NodeKind::Journey || !contains(parent.prop("children"), &node.id) {
            out.push(scope_error(&node, JOURNEY));
        }
    }
    for (node, _) in c.templates_of(|n| n.kind == NodeKind::Step) {
        out.push(scope_error(&node, STEP));
    }
    for (node, _) in c.templates_of(|n| n.kind == NodeKind::Journey) {
        out.push(scope_error(&node, JOURNEY));
    }
}

fn block_scope(c: &Ctx, out: &mut Vec<Diagnostic>) {
    for node in c.of_kind(Node::is_block) {
        let ok = match c.parent(&node) {
            Some(p) if p.is_block() => true,
            Some(p) if p.kind == NodeKind::Step => contains(p.prop("blocks"), &node.id),
            _ => false,
        };
        if !ok {
            out.push(scope_error(&node, "Blocks can only be defined in a step blocks array or nested within another block"));
        }
    }
}

fn field_code_uniqueness(c: &Ctx, out: &mut Vec<Diagnostic>) {
    let mut groups: indexmap::IndexMap<String, Vec<Arc<Node>>> = indexmap::IndexMap::new();
    for node in c.of_kind(|n| n.is_field_block()) {
        let Some(code) = node.prop("code").and_then(Prop::as_str).map(str::to_string) else { continue };
        let Some(step) = c.ancestors(&node).into_iter().find(|a| a.kind == NodeKind::Step) else { continue };
        groups.entry(format!("{}:{code}", step.id)).or_default().push(node);
    }
    for blocks in groups.values().filter(|b| b.len() >= 2) {
        for node in blocks.iter().filter(|b| b.prop("dependentWhen").is_none_or(Prop::is_undefined)) {
            let code = node.str_prop("code").unwrap_or_default();
            out.push(scope_error(
                node,
                format!(
                    "Field code '{code}' is shared by multiple blocks on the same step, so every one of them must declare dependentWhen to mark which variant is active"
                ),
            ));
        }
    }
}

fn walk_blocks_in_functions(prop: &Prop, inside: bool, out: &mut Vec<Diagnostic>) {
    match prop {
        Prop::Lit(_) => {}
        Prop::Array(items) => items.iter().for_each(|p| walk_blocks_in_functions(p, inside, out)),
        Prop::Object(o) => o.values().for_each(|p| walk_blocks_in_functions(p, inside, out)),
        Prop::Node(n) => {
            if inside && n.is_block() {
                out.push(scope_error(n, "Block definitions cannot be used as function arguments"));
            }
            let next = inside || is_function(n);
            n.props.values().for_each(|p| walk_blocks_in_functions(p, next, out));
        }
    }
}

fn function_arguments(c: &Ctx, out: &mut Vec<Diagnostic>) {
    for node in c.of_kind(Node::is_block) {
        if c.ancestors(&node).iter().any(|a| is_function(a)) {
            out.push(scope_error(&node, "Block definitions cannot be used as function arguments"));
        }
    }
    for node in c.of_kind(|n| is_expr(n, ExprKind::Iterate)) {
        for t in iterator_templates(&node) {
            walk_blocks_in_functions(&t, false, out);
        }
    }
}

fn check_entries(prop: Option<&Prop>, valid: fn(&Node) -> bool, message: &str, container: &Node, out: &mut Vec<Diagnostic>) {
    for entry in prop.and_then(Prop::as_array).unwrap_or_default() {
        match entry.as_node() {
            Some(n) if valid(n) => {}
            Some(n) => out.push(Diagnostic::new("ForgeReferenceScopeError", message).at(n.source_path.as_deref().map_or_else(|| path_of(container), str::to_string))),
            None => out.push(Diagnostic::new("ForgeReferenceScopeError", message).at(path_of(container))),
        }
    }
}

fn container_types(c: &Ctx, out: &mut Vec<Diagnostic>) {
    let access = |n: &Node| n.kind == NodeKind::Hook(HookKind::Access);
    let submit = |n: &Node| n.kind == NodeKind::Hook(HookKind::Submit);
    let effect = |n: &Node| is_expr(n, ExprKind::Effect);
    let outcome = |n: &Node| matches!(n.kind, NodeKind::Outcome(_));
    for step in c.of_kind(|n| n.kind == NodeKind::Step) {
        check_entries(step.prop("onAccess"), access, "onAccess can only contain access hooks", &step, out);
        check_entries(step.prop("onSubmission"), submit, "onSubmission can only contain submit hooks", &step, out);
        check_entries(step.prop("blocks"), Node::is_block, "blocks can only contain block definitions", &step, out);
    }
    for journey in c.of_kind(|n| n.kind == NodeKind::Journey) {
        check_entries(journey.prop("onAccess"), access, "onAccess can only contain access hooks", &journey, out);
    }
    for hook in c.of_kind(access) {
        check_entries(hook.prop("effects"), effect, "effects can only contain effect functions", &hook, out);
        check_entries(hook.prop("next"), outcome, "next can only contain outcomes", &hook, out);
    }
    for hook in c.of_kind(submit) {
        for branch in ["onAlways", "onValid", "onInvalid"] {
            check_entries(sub(hook.prop(branch), "effects").as_ref(), effect, "effects can only contain effect functions", &hook, out);
            check_entries(sub(hook.prop(branch), "next").as_ref(), outcome, "next can only contain outcomes", &hook, out);
        }
    }
}

/// `ASTSemanticValidator.validate`.
pub fn validate(index: &AstIndex, functions: &FunctionRegistry, components: &ComponentRegistry) -> ForgeResult<()> {
    let mut templates = Vec::new();
    for id in &index.order {
        let node = &index.nodes[id];
        if is_expr(node, ExprKind::Iterate) {
            for t in iterator_templates(node) {
                collect_templates(&t, node, &mut templates);
            }
        }
    }
    let c = Ctx { index, templates, functions, components };
    let mut out = Vec::new();
    let rules: [fn(&Ctx, &mut Vec<Diagnostic>); 16] = [
        reference_scopes,
        self_scope,
        answer_scope,
        effect_scope,
        registered_functions,
        function_arity,
        registered_components,
        validation_scope,
        outcome_scope,
        hook_scope,
        tie_breaker_scope,
        structure_scope,
        block_scope,
        field_code_uniqueness,
        function_arguments,
        container_types,
    ];
    for rule in rules {
        rule(&c, &mut out);
    }
    if out.is_empty() { Ok(()) } else { Err(aggregate("AST semantic validation failed", &out)) }
}

