//! Walks [`crate::ast::Node`] trees and produces output strings using an [`crate::Environment`] and JSON context.

use crate::ast::{BinOp, Expr, ForVars, MacroDef, MacroParam, Node, SwitchCase, UnaryOp};
use crate::environment::Environment;
use crate::errors::{Result, RunjucksError};
use crate::globals::{parse_cycler_id, parse_joiner_id, CyclerState, JoinerState, RJ_CALLABLE};
use crate::loader::TemplateLoader;
use crate::render_common::{
    add_like_js, apply_builtin_filter_chain_on_cow_value, as_number,
    collect_attr_chain_from_getattr, compare_values, eval_in, is_test_parts, is_truthy,
    iterable_empty, iterable_from_value, jinja_slice_array, json_num,
    peel_builtin_upper_lower_length_chain, ExtendsLayout, Iterable,
};
use crate::value::{is_undefined_value, mark_safe, undefined_value};
use ahash::AHashMap;
use rand::rngs::SmallRng;
use rand::SeedableRng;
use serde_json::{json, Map, Value};
use std::borrow::Cow;
use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

/// Nunjucks-style frame stack: inner frames shadow outer; `set` updates the innermost existing binding.
///
/// Values are stored as [`Arc`] so repeated reads and shallow copies of bindings can share the same
/// [`Value`] allocation when the stack is cloned or merged (see [`Self::flatten`]).
///
/// Frame maps use [`ahash::AHashMap`] for faster string-key lookup on hot paths (many distinct variables).
#[derive(Debug, Clone)]
pub struct CtxStack {
    pub(crate) frames: Vec<AHashMap<String, Arc<Value>>>,
    /// Where each object / array binding's value came from (parallel to `frames`), so `sameas`
    /// can tell apart objects with equal contents, as JavaScript reference identity does.
    origins: Vec<AHashMap<String, Origin>>,
    stack_id: u64,
    /// Incremented on any binding change (frames, `set`, `set_local`, `loop` injection).
    /// Used to reuse merged extension context snapshots when the stack is unchanged.
    revision: u64,
}

impl CtxStack {
    pub fn from_root(root: Map<String, Value>) -> Self {
        static NEXT_STACK_ID: AtomicU64 = AtomicU64::new(1);
        let mapped: AHashMap<String, Arc<Value>> =
            root.into_iter().map(|(k, v)| (k, Arc::new(v))).collect();
        Self {
            frames: vec![mapped],
            origins: vec![AHashMap::new()],
            stack_id: NEXT_STACK_ID.fetch_add(1, Ordering::Relaxed),
            revision: 0,
        }
    }

    #[inline]
    pub(crate) fn bump_revision(&mut self) {
        self.revision = self.revision.wrapping_add(1);
    }

    /// Monotonic counter; changes whenever template bindings or frames change.
    #[inline]
    pub fn revision(&self) -> u64 {
        self.revision
    }

    pub fn push_frame(&mut self) {
        self.frames.push(AHashMap::new());
        self.origins.push(AHashMap::new());
        self.bump_revision();
    }

    pub fn pop_frame(&mut self) {
        if self.frames.len() > 1 {
            self.frames.pop();
            self.origins.pop();
            self.bump_revision();
        }
    }

    /// Borrows the innermost binding for `name` across frames (template context shadows outer).
    pub fn get_ref(&self, name: &str) -> Option<&Value> {
        for f in self.frames.iter().rev() {
            if let Some(v) = f.get(name) {
                return Some(v.as_ref());
            }
        }
        None
    }

    pub fn get(&self, name: &str) -> Value {
        self.get_ref(name).cloned().unwrap_or(Value::Null)
    }

    pub fn defined(&self, name: &str) -> bool {
        self.frames.iter().rev().any(|f| f.contains_key(name))
    }

    pub fn set(&mut self, name: &str, value: Value) {
        let arc = Arc::new(value);
        for f in self.frames.iter_mut().rev() {
            if f.contains_key(name) {
                f.insert(name.to_string(), arc);
                self.bump_revision();
                return;
            }
        }
        if let Some(inner) = self.frames.last_mut() {
            inner.insert(name.to_string(), arc);
            self.bump_revision();
        }
    }

    /// Assign in the innermost frame only (for `for` / `loop.*` bindings so inner loops can shadow).
    pub fn set_local(&mut self, name: &str, value: Value) {
        if let Some(inner) = self.frames.last_mut() {
            inner.insert(name.to_string(), Arc::new(value));
            self.bump_revision();
        }
    }

    /// Records (or clears) the origin of the binding `name` currently resolves to.
    pub(crate) fn set_origin(&mut self, name: &str, origin: Option<Origin>) {
        let Some(idx) = self.frames.iter().rposition(|f| f.contains_key(name)) else { return };
        while self.origins.len() < self.frames.len() {
            self.origins.push(AHashMap::new());
        }
        match origin {
            Some(o) => {
                self.origins[idx].insert(name.to_string(), o);
            }
            None => {
                self.origins[idx].remove(name);
            }
        }
    }

    /// The origin of the binding `name`: recorded, or the context path for root-context values.
    pub(crate) fn origin(&self, name: &str) -> Option<Origin> {
        let idx = self.frames.iter().rposition(|f| f.contains_key(name))?;
        match self.origins.get(idx).and_then(|o| o.get(name)) {
            Some(o) => Some(o.clone()),
            None if idx == 0 => Some(Origin::Root(name.to_string())),
            None => None,
        }
    }

    /// Outer frames first, then inner overwrites (as [`Self::flatten`]).
    pub(crate) fn flatten_origins(&self) -> AHashMap<String, Origin> {
        let mut m = AHashMap::new();
        for (i, f) in self.frames.iter().enumerate() {
            for k in f.keys() {
                match self.origins.get(i).and_then(|o| o.get(k)) {
                    Some(o) => {
                        m.insert(k.clone(), o.clone());
                    }
                    None if i == 0 => {
                        m.insert(k.clone(), Origin::Root(k.clone()));
                    }
                    None => {
                        m.remove(k);
                    }
                }
            }
        }
        m
    }

    /// A stack over `root` whose bindings keep the given origins (macro bodies).
    pub(crate) fn from_root_with_origins(root: Map<String, Value>, origins: AHashMap<String, Origin>) -> Self {
        let mut s = Self::from_root(root);
        s.origins[0] = origins;
        s
    }

    /// Outer frames first, then inner overwrites — snapshot for macro bodies.
    pub fn flatten(&self) -> Map<String, Value> {
        let cap: usize = self.frames.iter().map(|f| f.len()).sum();
        let mut m = Map::with_capacity(cap);
        for f in &self.frames {
            for (k, v) in f {
                m.insert(k.clone(), v.as_ref().clone());
            }
        }
        m
    }
}

/// Where an object or array value came from: JavaScript compares objects by reference, and
/// template values here are copies, so `sameas` compares origins instead of contents.
#[derive(Debug, Clone, PartialEq)]
pub enum Origin {
    /// A root-context variable (the caller's object).
    Root(String),
    /// A property or element of another origin.
    Path(Box<Origin>, String),
    /// A list literal: its own identity plus each element's origin.
    List(u64, Vec<Option<Origin>>),
    /// Anything built during rendering (literals, filter and call results).
    Fresh(u64),
}

fn fresh_origin() -> Origin {
    static NEXT: AtomicU64 = AtomicU64::new(1);
    Origin::Fresh(NEXT.fetch_add(1, Ordering::Relaxed))
}

fn origin_path(base: Option<Origin>, key: String) -> Option<Origin> {
    match base? {
        Origin::List(_, elems) => key.parse::<usize>().ok().and_then(|i| elems.get(i).cloned().flatten()),
        o => Some(Origin::Path(Box::new(o), key)),
    }
}

fn is_reference_value(v: &Value) -> bool {
    matches!(v, Value::Object(_) | Value::Array(_)) && !crate::value::is_marked_safe(v) && !is_undefined_value(v)
}

/// The origin of the value `e` evaluates to (`None` when it cannot be tracked).
fn origin_of(env: &Environment, state: &mut RenderState<'_>, e: &Expr, stack: &mut CtxStack) -> Result<Option<Origin>> {
    Ok(match e {
        Expr::Variable(n) => stack.origin(n),
        Expr::GetAttr { base, attr } => origin_path(origin_of(env, state, base, stack)?, attr.clone()),
        Expr::GetItem { base, index } if !matches!(index.as_ref(), Expr::Slice { .. }) => {
            let key = crate::value::value_to_string(&eval_to_value(env, state, index, stack)?);
            origin_path(origin_of(env, state, base, stack)?, key)
        }
        Expr::List(items) => {
            let mut elems = Vec::with_capacity(items.len());
            for item in items {
                elems.push(origin_of(env, state, item, stack)?);
            }
            let Origin::Fresh(id) = fresh_origin() else { unreachable!() };
            Some(Origin::List(id, elems))
        }
        Expr::Filter { name, input, args } if (name == "default" || name == "d") && !args.is_empty() => {
            let value = eval_to_value(env, state, input, stack)?;
            let arg_vals: Vec<Value> = args.iter().map(|a| eval_to_value(env, state, a, stack)).collect::<Result<_>>()?;
            let use_or = arg_vals.get(1).and_then(|v| v.as_bool()).unwrap_or(false);
            let falsy = is_undefined_value(&value)
                || (use_or
                    && (value.is_null()
                        || matches!(value, Value::Bool(false))
                        || matches!(&value, Value::String(s) if s.is_empty())
                        || value.as_f64().is_some_and(|x| x == 0.0)));
            if falsy { origin_of(env, state, &args[0], stack)? } else { origin_of(env, state, input, stack)? }
        }
        Expr::InlineIf { cond, then_expr, else_expr } => {
            if is_truthy(&eval_to_value(env, state, cond, stack)?) {
                origin_of(env, state, then_expr, stack)?
            } else {
                match else_expr {
                    Some(e) => origin_of(env, state, e, stack)?,
                    None => None,
                }
            }
        }
        _ => Some(fresh_origin()),
    })
}

/// One active `{% call %}`: body to render for `caller()` / `caller(args…)`, plus optional formal parameters.
#[derive(Clone)]
pub struct CallerFrame {
    pub body: Vec<Node>,
    pub params: Vec<MacroParam>,
}

/// Per-render state: optional loader, include cycle stack, macro scopes, and block inheritance for `extends`.
pub struct RenderState<'a> {
    pub loader: Option<&'a (dyn TemplateLoader + Send + Sync)>,
    pub stack: Vec<String>,
    pub macro_scopes: Vec<HashMap<String, MacroDef>>,
    /// Closures of the imported macros currently executing (innermost last): a macro body sees its
    /// defining template's macros first.
    pub macro_closures: Vec<std::sync::Arc<HashMap<String, MacroDef>>>,
    /// Origins of the positional arguments of the macro call about to run (see [`Origin`]).
    pub pending_arg_origins: Vec<Option<Origin>>,
    /// `{% import "x" as ns %}` — macros callable as `ns.macro_name()`.
    pub macro_namespaces: HashMap<String, HashMap<String, MacroDef>>,
    /// Top-level `{% set %}` exports from each `import … as ns` namespace (`ns.name`): single- and
    /// multi-target `=` forms (same value per target) and block `{% set x %}…{% endset %}`, evaluated
    /// in source order. Also used with `macro_namespaces` for resolving `ns.*`.
    pub macro_namespace_values: HashMap<String, HashMap<String, Value>>,
    /// Per-block inheritance: innermost template first (child → parent → …) for `{{ super() }}`.
    pub block_chains: Option<HashMap<String, Vec<Vec<Node>>>>,
    /// When rendering a block layer, `Some((block_name, layer_index))` for `super()` resolution.
    pub super_context: Option<(String, usize)>,
    /// Innermost `{% call %}` frame for `caller()` / `caller(args…)` inside macro execution.
    pub caller_stack: Vec<CallerFrame>,
    /// Stateful `cycler(...)` instances (index matches handle object).
    pub cyclers: Vec<CyclerState>,
    /// Stateful `joiner(...)` instances.
    pub joiners: Vec<JoinerState>,
    /// PRNG for `| random` (seed from [`Environment::random_seed`] when set).
    pub rng: SmallRng,
    /// Cached `stack.flatten()` for [`Node::ExtensionTag`] when both stack identity and
    /// [`CtxStack::revision`] match.
    extension_context_cache: Option<(usize, u64, Value)>,
}

impl<'a> RenderState<'a> {
    pub fn new(
        loader: Option<&'a (dyn TemplateLoader + Send + Sync)>,
        rng_seed: Option<u64>,
    ) -> Self {
        let rng = match rng_seed {
            Some(s) => SmallRng::seed_from_u64(s),
            None => SmallRng::from_entropy(),
        };
        Self {
            loader,
            stack: Vec::new(),
            macro_scopes: Vec::new(),
            macro_closures: Vec::new(),
            pending_arg_origins: Vec::new(),
            macro_namespaces: HashMap::new(),
            macro_namespace_values: HashMap::new(),
            block_chains: None,
            super_context: None,
            caller_stack: Vec::new(),
            cyclers: Vec::new(),
            joiners: Vec::new(),
            rng,
            extension_context_cache: None,
        }
    }

    pub fn push_template(&mut self, name: &str) -> Result<()> {
        if self.stack.iter().any(|s| s == name) {
            return Err(RunjucksError::new(format!(
                "circular template reference: {name}"
            )));
        }
        self.stack.push(name.to_string());
        Ok(())
    }

    pub fn pop_template(&mut self) {
        self.stack.pop();
    }

    pub fn push_macros(&mut self, defs: HashMap<String, MacroDef>) {
        self.macro_scopes.push(defs);
    }

    pub fn pop_macros(&mut self) {
        self.macro_scopes.pop();
    }

    pub fn lookup_macro(&self, name: &str) -> Option<&MacroDef> {
        if let Some(m) = self.macro_closures.last().and_then(|c| c.get(name)) {
            return Some(m);
        }
        for scope in self.macro_scopes.iter().rev() {
            if let Some(m) = scope.get(name) {
                return Some(m);
            }
        }
        None
    }

    pub fn lookup_namespaced_macro(&self, ns: &str, macro_name: &str) -> Option<&MacroDef> {
        self.macro_namespaces
            .get(ns)
            .and_then(|m| m.get(macro_name))
    }

    pub fn lookup_namespaced_value(&self, ns: &str, name: &str) -> Option<&Value> {
        self.macro_namespace_values
            .get(ns)
            .and_then(|m| m.get(name))
    }
}

#[inline]
fn stack_identity(stack: &CtxStack) -> usize {
    stack.stack_id as usize
}

/// Renders `root` to a string using `env` and `ctx_stack`.
pub fn render(
    env: &Environment,
    loader: Option<&(dyn TemplateLoader + Send + Sync)>,
    root: &Node,
    ctx_stack: &mut CtxStack,
) -> Result<String> {
    let mut state = RenderState::new(loader, env.random_seed);
    render_entry(env, &mut state, root, ctx_stack)
}

/// Entry: handle `{% extends %}` child templates, otherwise normal render.
pub fn render_entry(
    env: &Environment,
    state: &mut RenderState<'_>,
    root: &Node,
    ctx_stack: &mut CtxStack,
) -> Result<String> {
    if let Some((parent_expr, blocks, prelude)) = extract_layout_if_any(root)? {
        for n in &prelude {
            render_node(env, state, n, ctx_stack)?;
        }
        let parent_name =
            crate::value::value_to_string(&eval_to_value(env, state, &parent_expr, ctx_stack)?);
        render_extends(env, state, &parent_name, blocks, ctx_stack)
    } else {
        render_with_state(env, state, root, ctx_stack)
    }
}

pub(crate) fn extract_layout_if_any(root: &Node) -> Result<Option<ExtendsLayout>> {
    let Node::Root(children) = root else {
        return Ok(None);
    };
    // Nunjucks: a template with `{% extends %}` anywhere at its top level renders its parent.
    // Everything else at the top level still runs (for `set`, `import`, loops...), but its
    // output is discarded.
    let Some(parent) = children.iter().find_map(|n| match n {
        Node::Extends { parent } => Some(parent.clone()),
        _ => None,
    }) else {
        return Ok(None);
    };
    let mut blocks = HashMap::new();
    let mut prelude = Vec::new();
    collect_nested_blocks(children, &mut blocks);
    for n in children {
        match n {
            Node::Block { .. } => {}
            Node::Extends { .. } | Node::MacroDef(_) => {}
            Node::Text(_) => {}
            other => prelude.push(other.clone()),
        }
    }
    Ok(Some((parent, blocks, prelude)))
}

pub(crate) fn collect_blocks_in_root(root: &Node) -> HashMap<String, Vec<Node>> {
    let Node::Root(children) = root else {
        return HashMap::new();
    };
    let mut m = HashMap::new();
    collect_nested_blocks(children, &mut m);
    m
}

/// Nunjucks registers every `{% block %}` in a template (`findAll(nodes.Block)`), including
/// blocks nested in other blocks or in tags, so a child can override (and `super()`) a nested
/// block such as GOV.UK's `govukFooter` inside `footer`. Macro bodies are their own scope.
pub(crate) fn collect_nested_blocks(nodes: &[Node], out: &mut HashMap<String, Vec<Node>>) {
    for n in nodes {
        match n {
            Node::Block { name, body } => {
                out.entry(name.clone()).or_insert_with(|| body.clone());
                collect_nested_blocks(body, out);
            }
            Node::If { branches } | Node::IfAsync { branches } => {
                for b in branches {
                    collect_nested_blocks(&b.body, out);
                }
            }
            Node::For { body, else_body, .. }
            | Node::AsyncEach { body, else_body, .. }
            | Node::AsyncAll { body, else_body, .. } => {
                collect_nested_blocks(body, out);
                if let Some(e) = else_body {
                    collect_nested_blocks(e, out);
                }
            }
            Node::Switch { cases, default_body, .. } => {
                for c in cases {
                    collect_nested_blocks(&c.body, out);
                }
                if let Some(d) = default_body {
                    collect_nested_blocks(d, out);
                }
            }
            Node::Set { body: Some(body), .. }
            | Node::FilterBlock { body, .. }
            | Node::CallBlock { body, .. } => collect_nested_blocks(body, out),
            _ => {}
        }
    }
}

pub(crate) fn extends_parent_expr(root: &Node) -> Option<&Expr> {
    let Node::Root(children) = root else {
        return None;
    };
    for n in children {
        if let Node::Extends { parent } = n {
            return Some(parent);
        }
    }
    None
}

/// Block bodies from innermost (overriding child) to outermost for each block name.
#[allow(clippy::too_many_arguments)]
fn build_block_chains(
    parent_name: &str,
    parent_ast: &Node,
    immediate_child_overrides: &HashMap<String, Vec<Node>>,
    loader: &(dyn TemplateLoader + Send + Sync),
    visited: &mut HashSet<String>,
    env: &Environment,
    state: &mut RenderState<'_>,
    ctx_stack: &mut CtxStack,
) -> Result<HashMap<String, Vec<Vec<Node>>>> {
    if !visited.insert(parent_name.to_string()) {
        return Err(RunjucksError::new(format!(
            "circular `{{% extends %}}` involving `{parent_name}`"
        )));
    }

    let result = (|| {
        let local_blocks = collect_blocks_in_root(parent_ast);
        let inherited: HashMap<String, Vec<Vec<Node>>> =
            if let Some(gp_expr) = extends_parent_expr(parent_ast) {
                let gp_name =
                    crate::value::value_to_string(&eval_to_value(env, state, gp_expr, ctx_stack)?);
                let gp_ast = env.load_and_parse_named(&gp_name, loader)?;
                build_block_chains(
                    &gp_name,
                    gp_ast.as_ref(),
                    &local_blocks,
                    loader,
                    visited,
                    env,
                    state,
                    ctx_stack,
                )?
            } else {
                HashMap::new()
            };

        let mut all_names: HashSet<String> = immediate_child_overrides.keys().cloned().collect();
        all_names.extend(local_blocks.keys().cloned());
        all_names.extend(inherited.keys().cloned());

        let mut out = HashMap::new();
        for name in all_names {
            let mut chain: Vec<Vec<Node>> = Vec::new();
            if let Some(c) = immediate_child_overrides.get(&name) {
                chain.push(c.clone());
            }
            if let Some(rest) = inherited.get(&name) {
                chain.extend(rest.iter().cloned());
            } else if let Some(l) = local_blocks.get(&name) {
                chain.push(l.clone());
            }
            if !chain.is_empty() {
                out.insert(name, chain);
            }
        }
        Ok(out)
    })();

    visited.remove(parent_name);
    result
}

fn render_extends(
    env: &Environment,
    state: &mut RenderState<'_>,
    parent_name: &str,
    blocks: HashMap<String, Vec<Node>>,
    ctx_stack: &mut CtxStack,
) -> Result<String> {
    let loader = state
        .loader
        .ok_or_else(|| RunjucksError::new("`extends` requires a template loader"))?;
    let parent_ast = env.load_and_parse_named(parent_name, loader)?;
    state.push_template(parent_name)?;
    let mut visited = HashSet::new();
    let chains = build_block_chains(
        parent_name,
        parent_ast.as_ref(),
        &blocks,
        loader,
        &mut visited,
        env,
        state,
        ctx_stack,
    )?;
    // Walk up to the root layout, running each intermediate layout's prelude on the way, and
    // render the root with the full block chains.
    let mut root_ast = parent_ast;
    let mut pushed = 1;
    while let Some((gp_expr, _, prelude)) = extract_layout_if_any(root_ast.as_ref())? {
        for n in &prelude {
            render_node(env, state, n, ctx_stack)?;
        }
        let gp_name = crate::value::value_to_string(&eval_to_value(env, state, &gp_expr, ctx_stack)?);
        root_ast = env.load_and_parse_named(&gp_name, loader)?;
        state.push_template(&gp_name)?;
        pushed += 1;
    }
    let prev_chains = state.block_chains.take();
    state.block_chains = Some(chains);
    let out = render_with_state(env, state, root_ast.as_ref(), ctx_stack);
    state.block_chains = prev_chains;
    for _ in 0..pushed {
        state.pop_template();
    }
    out
}

fn render_with_state(
    env: &Environment,
    state: &mut RenderState<'_>,
    root: &Node,
    ctx_stack: &mut CtxStack,
) -> Result<String> {
    render_node(env, state, root, ctx_stack)
}

/// Top-level `{% macro %}` definitions only (Nunjucks `getExported` surface for macro libraries).
pub(crate) fn collect_top_level_macros(root: &Node) -> HashMap<String, MacroDef> {
    let mut m = HashMap::new();
    let Node::Root(children) = root else {
        return m;
    };
    for n in children {
        if let Node::MacroDef(def) = n {
            m.insert(def.name.clone(), def.clone());
        }
    }
    m
}

/// The macros a loaded template exports, each closing over the macros visible at that template's
/// top level: its own `{% macro %}`s plus those it brings in with literal `{% from … import … %}`.
pub(crate) fn module_macros(
    env: &Environment,
    state: &mut RenderState<'_>,
    root: &Node,
    loader: &(dyn TemplateLoader + Send + Sync),
) -> Result<HashMap<String, MacroDef>> {
    let own = collect_top_level_macros(root);
    let mut scope: HashMap<String, MacroDef> = HashMap::new();
    if let Node::Root(children) = root {
        for n in children {
            let Node::FromImport { template, names, .. } = n else { continue };
            let Expr::Literal(Value::String(path)) = template else { continue };
            state.push_template(path)?;
            let nested = env.load_and_parse_named(path, loader)?;
            let nested_defs = module_macros(env, state, nested.as_ref(), loader);
            state.pop_template();
            let nested_defs = nested_defs?;
            for (export_name, alias) in names {
                if let Some(def) = nested_defs.get(export_name) {
                    scope.insert(alias.as_ref().unwrap_or(export_name).clone(), def.clone());
                }
            }
        }
    }
    for (name, def) in &own {
        scope.insert(name.clone(), def.clone());
    }
    let closure = std::sync::Arc::new(scope);
    Ok(own
        .into_iter()
        .map(|(name, mut def)| {
            def.closure = Some(closure.clone());
            (name, def)
        })
        .collect())
}

/// Top-level `{% set … %}` forms that participate in `{% import %}` / `{% from %}` exports (same
/// order as source; mirrors [`Node::Set`] rendering for multi-target and block capture).
pub(crate) enum TopLevelSetExport {
    /// `{% set a = expr %}`, `{% set a, b = expr %}` (same value cloned to every target).
    FromExpr { targets: Vec<String>, expr: Expr },
    /// `{% set name %}…{% endset %}` (parser allows only one target for block form).
    FromBlock { target: String, body: Vec<Node> },
}

pub(crate) fn collect_top_level_set_exports(root: &Node) -> Vec<TopLevelSetExport> {
    let mut out = Vec::new();
    let Node::Root(children) = root else {
        return out;
    };
    for n in children {
        match n {
            Node::Set {
                targets,
                value: Some(expr),
                body: None,
            } if !targets.is_empty() => {
                out.push(TopLevelSetExport::FromExpr {
                    targets: targets.clone(),
                    expr: expr.clone(),
                });
            }
            Node::Set {
                targets,
                value: None,
                body: Some(body),
            } if targets.len() == 1 => {
                out.push(TopLevelSetExport::FromBlock {
                    target: targets[0].clone(),
                    body: body.clone(),
                });
            }
            _ => {}
        }
    }
    out
}

/// Evaluates exported top-level assignments (`getExported`) with Nunjucks-style context:
/// `with context` → parent context; omitted or `without context` → isolated root (globals still resolve via [`Environment`].
fn eval_exported_top_level_sets(
    env: &Environment,
    state: &mut RenderState<'_>,
    root: &Node,
    ctx_stack: &mut CtxStack,
    with_context: Option<bool>,
) -> Result<HashMap<String, Value>> {
    let mut out = HashMap::new();
    let exports = collect_top_level_set_exports(root);
    let mut import_stack = if matches!(with_context, Some(true)) {
        CtxStack::from_root(ctx_stack.flatten())
    } else {
        CtxStack::from_root(Map::new())
    };
    for ex in exports {
        match ex {
            TopLevelSetExport::FromExpr { targets, expr } => {
                let v = eval_to_value(env, state, &expr, &mut import_stack)?;
                for t in &targets {
                    import_stack.set(t, v.clone());
                }
                for t in &targets {
                    out.insert(t.clone(), v.clone());
                }
            }
            TopLevelSetExport::FromBlock { target, body } => {
                let s = render_children(env, state, &body, &mut import_stack)?;
                let val = Value::String(s);
                import_stack.set(&target, val.clone());
                out.insert(target, val);
            }
        }
    }
    Ok(out)
}

/// Detects `{% import "x" %}` / `{% from "x" %}` cycles using **string-literal** paths only (matches
/// typical macro libraries; dynamic names are not traced here).
/// Detects `{% extends "x" %}` cycles using **string-literal** parents only (same idea as
/// [`scan_literal_import_graph`]; dynamic `{% extends expr %}` is checked at render time).
pub(crate) fn scan_literal_extends_graph(
    env: &Environment,
    state: &mut RenderState<'_>,
    root: &Node,
    loader: &(dyn TemplateLoader + Send + Sync),
) -> Result<()> {
    let Some(expr) = extends_parent_expr(root) else {
        return Ok(());
    };
    let Expr::Literal(Value::String(path)) = expr else {
        return Ok(());
    };
    state.push_template(path)?;
    let nested = env.load_and_parse_named(path, loader)?;
    let r = scan_literal_extends_graph(env, state, nested.as_ref(), loader);
    state.pop_template();
    r
}

pub(crate) fn scan_literal_import_graph(
    env: &Environment,
    state: &mut RenderState<'_>,
    root: &Node,
    loader: &(dyn TemplateLoader + Send + Sync),
) -> Result<()> {
    let Node::Root(children) = root else {
        return Ok(());
    };
    for n in children {
        let template_expr = match n {
            Node::Import { template, .. } | Node::FromImport { template, .. } => template,
            _ => continue,
        };
        let Expr::Literal(Value::String(path)) = template_expr else {
            continue;
        };
        state.push_template(path)?;
        let nested = env.load_and_parse_named(path, loader)?;
        scan_literal_import_graph(env, state, nested.as_ref(), loader)?;
        state.pop_template();
    }
    Ok(())
}

fn render_node(
    env: &Environment,
    state: &mut RenderState<'_>,
    n: &Node,
    stack: &mut CtxStack,
) -> Result<String> {
    match n {
        Node::Root(nodes) => {
            let mut defs = HashMap::new();
            for n in nodes.iter() {
                if let Node::MacroDef(m) = n {
                    defs.insert(m.name.clone(), m.clone());
                }
            }
            let had_macros = !defs.is_empty();
            let scope_base = state.macro_scopes.len();
            if had_macros {
                state.push_macros(defs);
            }
            let mut out = String::new();
            out.reserve(nodes.len().saturating_mul(32));
            for child in nodes.iter() {
                if matches!(child, Node::MacroDef(_) | Node::Extends { .. }) {
                    continue;
                }
                out.push_str(&render_node(env, state, child, stack)?);
            }
            while state.macro_scopes.len() > scope_base {
                state.pop_macros();
            }
            Ok(out)
        }
        Node::Text(s) => Ok(s.to_string()),
        Node::Output(exprs) => render_output(env, state, exprs, stack),
        Node::If { branches } => {
            for br in branches {
                if let Some(cond) = &br.cond {
                    if !is_truthy(&eval_to_value(env, state, cond, stack)?) {
                        continue;
                    }
                }
                return render_children(env, state, &br.body, stack);
            }
            Ok(String::new())
        }
        Node::Switch {
            expr,
            cases,
            default_body,
        } => render_switch(env, state, expr, cases, default_body.as_deref(), stack),
        Node::For {
            vars,
            iter,
            body,
            else_body,
        } => render_for(env, state, vars, iter, body, else_body.as_deref(), stack),
        Node::Set {
            targets,
            value,
            body,
        } => {
            if let Some(expr) = value {
                let v = eval_to_value(env, state, expr, stack)?;
                let origin = if is_reference_value(&v) { origin_of(env, state, expr, stack)? } else { None };
                for t in targets {
                    stack.set(t, v.clone());
                    stack.set_origin(t, origin.clone());
                }
            } else if let Some(nodes) = body {
                let s = render_children(env, state, nodes, stack)?;
                if let Some(t) = targets.first() {
                    stack.set(t, Value::String(s));
                    stack.set_origin(t, None);
                }
            }
            Ok(String::new())
        }
        Node::Include {
            template,
            ignore_missing,
            with_context,
        } => {
            let loader = state
                .loader
                .ok_or_else(|| RunjucksError::new("`include` requires a template loader"))?;
            let name = crate::value::value_to_string(&eval_to_value(env, state, template, stack)?);
            let included = match env.load_and_parse_named(&name, loader) {
                Ok(ast) => ast,
                Err(_) if *ignore_missing => return Ok(String::new()),
                Err(e) => return Err(e),
            };
            state.push_template(&name)?;
            let out = if matches!(with_context, Some(false)) {
                let mut isolated = CtxStack::from_root(Map::new());
                render_entry(env, state, included.as_ref(), &mut isolated)?
            } else {
                // Nunjucks include-with-context receives parent bindings as input, but `{% set %}`
                // inside the included template must not leak back into the caller frame.
                let mut scoped = CtxStack::from_root(stack.flatten());
                render_entry(env, state, included.as_ref(), &mut scoped)?
            };
            state.pop_template();
            Ok(out)
        }
        Node::Import {
            template,
            alias,
            with_context,
        } => {
            let loader = state
                .loader
                .ok_or_else(|| RunjucksError::new("`import` requires a template loader"))?;
            let name = crate::value::value_to_string(&eval_to_value(env, state, template, stack)?);
            let imported = env.load_and_parse_named(&name, loader)?;
            state.push_template(&name)?;
            scan_literal_import_graph(env, state, imported.as_ref(), loader)?;
            let defs = module_macros(env, state, imported.as_ref(), loader)?;
            let exported_sets =
                eval_exported_top_level_sets(env, state, imported.as_ref(), stack, *with_context)?;
            state.pop_template();
            state.macro_namespaces.insert(alias.clone(), defs);
            state
                .macro_namespace_values
                .insert(alias.clone(), exported_sets);
            Ok(String::new())
        }
        Node::FromImport {
            template,
            names,
            with_context,
        } => {
            let loader = state
                .loader
                .ok_or_else(|| RunjucksError::new("`from` requires a template loader"))?;
            let name = crate::value::value_to_string(&eval_to_value(env, state, template, stack)?);
            let imported = env.load_and_parse_named(&name, loader)?;
            state.push_template(&name)?;
            scan_literal_import_graph(env, state, imported.as_ref(), loader)?;
            let defs = module_macros(env, state, imported.as_ref(), loader)?;
            let exported_sets =
                eval_exported_top_level_sets(env, state, imported.as_ref(), stack, *with_context)?;
            state.pop_template();
            let mut scope = HashMap::new();
            for (export_name, alias_opt) in names {
                let local = alias_opt.as_ref().unwrap_or(export_name);
                if let Some(mdef) = defs.get(export_name) {
                    scope.insert(local.clone(), mdef.clone());
                } else if let Some(v) = exported_sets.get(export_name) {
                    stack.set(local, v.clone());
                } else {
                    return Err(RunjucksError::new(format!("cannot import '{export_name}'")));
                }
            }
            state.push_macros(scope);
            Ok(String::new())
        }
        Node::Extends { .. } => Err(RunjucksError::new(
            "`extends` is only valid at the top level of a loaded template",
        )),
        Node::Block { name, body } => {
            let to_render: Vec<Node> = if let Some(ref chains) = state.block_chains {
                chains
                    .get(name)
                    .and_then(|ch| ch.first().cloned())
                    .unwrap_or_else(|| body.clone())
            } else {
                body.clone()
            };
            let prev_super = state.super_context.take();
            state.super_context = Some((name.clone(), 0));
            let out = render_children(env, state, &to_render, stack);
            state.super_context = prev_super;
            out
        }
        Node::FilterBlock { name, args, body } => {
            #[cfg(feature = "async")]
            if env.async_custom_filters.contains_key(name) {
                return Err(RunjucksError::new(format!(
                    "`{name}` is an async filter and can only be used with `renderStringAsync()` or `renderTemplateAsync()`"
                )));
            }
            let s = render_children(env, state, body, stack)?;
            let arg_vals: Vec<Value> = args
                .iter()
                .map(|a| eval_to_value(env, state, a, stack))
                .collect::<Result<_>>()?;
            let v = crate::filters::apply_builtin(
                env,
                &mut state.rng,
                name,
                &Value::String(s),
                &arg_vals,
            )?;
            let out = crate::value::value_to_string(&v);
            if env.autoescape && !crate::value::is_marked_safe(&v) {
                Ok(crate::filters::escape_html(&out))
            } else {
                Ok(out)
            }
        }
        Node::CallBlock {
            caller_params,
            callee,
            body,
        } => {
            let Expr::Call {
                callee: macro_target,
                args,
                kwargs,
            } = callee
            else {
                return Err(RunjucksError::new(
                    "`{% call %}` expects a macro call expression such as `wrap()` or `ns.wrap()`",
                ));
            };
            let arg_vals: Vec<Value> = args
                .iter()
                .map(|a| eval_to_value(env, state, a, stack))
                .collect::<Result<_>>()?;
            let kw_vals: Vec<(String, Value)> = kwargs
                .iter()
                .map(|(k, e)| Ok((k.clone(), eval_to_value(env, state, e, stack)?)))
                .collect::<Result<_>>()?;
            let mdef = if let Expr::Variable(name) = macro_target.as_ref() {
                state
                    .lookup_macro(name)
                    .cloned()
                    .ok_or_else(|| RunjucksError::new(format!("unknown macro `{name}`")))?
            } else if let Expr::GetAttr { base, attr } = macro_target.as_ref() {
                if let Expr::Variable(ns) = base.as_ref() {
                    state
                        .lookup_namespaced_macro(ns, attr)
                        .cloned()
                        .ok_or_else(|| RunjucksError::new(format!("unknown macro `{ns}.{attr}`")))?
                } else {
                    return Err(RunjucksError::new(
                        "`{% call %}` only supports simple macro or `namespace.macro()` calls",
                    ));
                }
            } else {
                return Err(RunjucksError::new(
                    "`{% call %}` only supports simple macro or `namespace.macro()` calls",
                ));
            };
            let frame = CallerFrame {
                body: body.clone(),
                params: caller_params.clone(),
            };
            state.caller_stack.push(frame);
            let module_closure_owned =
                if let Expr::GetAttr { base, attr: _ } = macro_target.as_ref() {
                    if let Expr::Variable(ns) = base.as_ref() {
                        state.macro_namespace_values.get(ns).cloned()
                    } else {
                        None
                    }
                } else {
                    None
                };
            let res = render_macro_body(
                env,
                state,
                &mdef,
                &arg_vals,
                &kw_vals,
                stack,
                module_closure_owned.as_ref(),
            );
            state.caller_stack.pop();
            res
        }
        Node::ExtensionTag {
            extension_name,
            args,
            body,
            ..
        } => {
            let handler = env.custom_extensions.get(extension_name).ok_or_else(|| {
                RunjucksError::new(format!("unknown extension `{extension_name}`"))
            })?;
            let sid = stack_identity(stack);
            let rev = stack.revision();
            let ctx_for_handler = match state.extension_context_cache.take() {
                Some((cached_sid, r, v)) if cached_sid == sid && r == rev => v,
                _ => Value::Object(stack.flatten()),
            };
            let body_s = if let Some(nodes) = body {
                Some(render_children(env, state, nodes, stack)?)
            } else {
                None
            };
            let out = handler(&ctx_for_handler, args.as_str(), body_s)?;
            state.extension_context_cache = Some((sid, rev, ctx_for_handler));
            Ok(if env.autoescape {
                crate::filters::escape_html(&out)
            } else {
                out
            })
        }
        Node::AsyncEach { .. } => Err(RunjucksError::new(
            "`{% asyncEach %}` requires async render mode; use `renderStringAsync()` or `renderTemplateAsync()`",
        )),
        Node::AsyncAll { .. } => Err(RunjucksError::new(
            "`{% asyncAll %}` requires async render mode; use `renderStringAsync()` or `renderTemplateAsync()`",
        )),
        Node::IfAsync { .. } => Err(RunjucksError::new(
            "`{% ifAsync %}` requires async render mode; use `renderStringAsync()` or `renderTemplateAsync()`",
        )),
        Node::MacroDef(_) => Ok(String::new()),
    }
}

fn render_switch(
    env: &Environment,
    state: &mut RenderState<'_>,
    disc_expr: &Expr,
    cases: &[SwitchCase],
    default_body: Option<&[Node]>,
    stack: &mut CtxStack,
) -> Result<String> {
    let disc = eval_to_value(env, state, disc_expr, stack)?;
    let mut start = None;
    for (i, c) in cases.iter().enumerate() {
        if eval_to_value(env, state, &c.cond, stack)? == disc {
            start = Some(i);
            break;
        }
    }
    let mut acc = String::new();
    if let Some(mut idx) = start {
        loop {
            let body = &cases[idx].body;
            acc.push_str(&render_children(env, state, body, stack)?);
            if !body.is_empty() {
                return Ok(acc);
            }
            idx += 1;
            if idx >= cases.len() {
                break;
            }
        }
    }
    if let Some(db) = default_body {
        acc.push_str(&render_children(env, state, db, stack)?);
    }
    Ok(acc)
}

fn inject_loop(stack: &mut CtxStack, i: usize, len: usize) {
    crate::render_common::inject_loop(&mut stack.frames, i, len);
    stack.bump_revision();
}

fn render_for(
    env: &Environment,
    state: &mut RenderState<'_>,
    vars: &ForVars,
    iter_expr: &Expr,
    body: &[Node],
    else_body: Option<&[Node]>,
    stack: &mut CtxStack,
) -> Result<String> {
    let v = eval_to_value(env, state, iter_expr, stack)?;
    let collection_origin = if is_reference_value(&v) { origin_of(env, state, iter_expr, stack)? } else { None };
    // Iterating `undefined` yields nothing (it is an internal marker object, not a mapping).
    let v = if is_undefined_value(&v) { Value::Null } else { v };
    let it = iterable_from_value(v);
    if iterable_empty(&it) {
        return if let Some(eb) = else_body {
            render_children(env, state, eb, stack)
        } else {
            Ok(String::new())
        };
    }

    stack.push_frame();
    let mut acc = String::new();

    match (vars, it) {
        (ForVars::Single(x), Iterable::Rows(items)) => {
            let len = items.len();
            acc.reserve(len.saturating_mul(16));
            for (i, item) in items.into_iter().enumerate() {
                inject_loop(stack, i, len);
                let origin = if is_reference_value(&item) { origin_path(collection_origin.clone(), i.to_string()) } else { None };
                stack.set_local(x, item);
                stack.set_origin(x, origin);
                acc.push_str(&render_children(env, state, body, stack)?);
            }
        }
        (ForVars::Multi(names), Iterable::Rows(rows)) if names.len() >= 2 => {
            let len = rows.len();
            acc.reserve(len.saturating_mul(16));
            for (i, row) in rows.into_iter().enumerate() {
                inject_loop(stack, i, len);
                if let Value::Array(cols) = row {
                    for (u, name) in names.iter().enumerate() {
                        let cell = cols.get(u).cloned().unwrap_or(Value::Null);
                        stack.set_local(name, cell);
                    }
                } else {
                    for name in names {
                        stack.set_local(name, Value::Null);
                    }
                }
                acc.push_str(&render_children(env, state, body, stack)?);
            }
        }
        (ForVars::Multi(names), Iterable::Pairs(pairs)) if names.len() == 2 => {
            let len = pairs.len();
            acc.reserve(len.saturating_mul(16));
            for (i, (k, v)) in pairs.into_iter().enumerate() {
                inject_loop(stack, i, len);
                let origin = if is_reference_value(&v) { origin_path(collection_origin.clone(), k.clone()) } else { None };
                stack.set_local(&names[0], Value::String(k));
                stack.set_local(&names[1], v);
                stack.set_origin(&names[1], origin);
                acc.push_str(&render_children(env, state, body, stack)?);
            }
        }
        (ForVars::Single(_), _) | (ForVars::Multi(_), _) => {
            stack.pop_frame();
            return if let Some(eb) = else_body {
                render_children(env, state, eb, stack)
            } else {
                Ok(String::new())
            };
        }
    }

    stack.pop_frame();
    Ok(acc)
}

fn render_children(
    env: &Environment,
    state: &mut RenderState<'_>,
    nodes: &[Node],
    stack: &mut CtxStack,
) -> Result<String> {
    let mut out = String::new();
    out.reserve(nodes.len().saturating_mul(32));
    for child in nodes {
        out.push_str(&render_node(env, state, child, stack)?);
    }
    Ok(out)
}

fn render_output(
    env: &Environment,
    state: &mut RenderState<'_>,
    exprs: &[Expr],
    stack: &mut CtxStack,
) -> Result<String> {
    let mut out = String::new();
    out.reserve(exprs.len().saturating_mul(24));
    for e in exprs {
        out.push_str(&eval_for_output(env, state, e, stack)?);
    }
    Ok(out)
}

#[cfg(feature = "async")]
fn filter_chain_has_async_override(env: &Environment, e: &Expr) -> bool {
    let mut cur = e;
    loop {
        match cur {
            Expr::Filter { name, input, .. } => {
                if env.async_custom_filters.contains_key(name) {
                    return true;
                }
                cur = input.as_ref();
            }
            _ => return false,
        }
    }
}

fn try_apply_peeled_builtin_filter_chain_value(
    env: &Environment,
    stack: &mut CtxStack,
    e: &Expr,
) -> Option<Result<Value>> {
    #[cfg(feature = "async")]
    if filter_chain_has_async_override(env, e) {
        return None;
    }
    let (rev_names, leaf) = peel_builtin_upper_lower_length_chain(e, &env.custom_filters)?;
    match leaf {
        Expr::Variable(var_name) => {
            let v = match env.resolve_variable_ref(stack, var_name) {
                Ok(v) => v,
                Err(e) => return Some(Err(e)),
            };
            Some(apply_builtin_filter_chain_on_cow_value(v, &rev_names))
        }
        Expr::Literal(Value::String(s)) => {
            let mut current = s.clone();
            for n in &rev_names {
                match *n {
                    "upper" => current = current.to_uppercase(),
                    "lower" => current = current.to_lowercase(),
                    "trim" => {
                        current = current
                            .trim_matches(|c: char| c.is_whitespace())
                            .to_string();
                    }
                    "capitalize" => {
                        current = crate::filters::capitalize_string_slice(&current);
                    }
                    "length" => return Some(Ok(json!(current.chars().count()))),
                    _ => unreachable!(),
                }
            }
            Some(Ok(Value::String(current)))
        }
        Expr::Literal(Value::Array(a)) if rev_names == ["length"] => Some(Ok(json!(a.len()))),
        _ => None,
    }
}

fn eval_for_output(
    env: &Environment,
    state: &mut RenderState<'_>,
    e: &Expr,
    stack: &mut CtxStack,
) -> Result<String> {
    match e {
        Expr::Literal(v) => Ok(crate::value::value_to_string(v)),
        Expr::Variable(name) => {
            let v = env.resolve_variable_ref(stack, name)?;
            let s = crate::value::value_to_string(v.as_ref());
            if env.autoescape && !crate::value::is_marked_safe(v.as_ref()) {
                Ok(crate::filters::escape_html(&s))
            } else {
                Ok(s)
            }
        }
        Expr::Filter { name, input, args } => {
            #[cfg(feature = "async")]
            if env.async_custom_filters.contains_key(name) {
                return Err(RunjucksError::new(format!(
                    "`{name}` is an async filter and can only be used with `renderStringAsync()` or `renderTemplateAsync()`"
                )));
            }
            if args.is_empty() {
                if let Some((rev_names, leaf)) =
                    peel_builtin_upper_lower_length_chain(e, &env.custom_filters)
                {
                    match leaf {
                        Expr::Variable(var_name) => {
                            let v = env.resolve_variable_ref(stack, var_name)?;
                            let input_safe = crate::value::is_marked_safe(v.as_ref());
                            match apply_builtin_filter_chain_on_cow_value(v, &rev_names) {
                                Ok(val) => {
                                    let s = crate::value::value_to_string(&val);
                                    let escape = env.autoescape
                                        && match &val {
                                            Value::String(_) => !input_safe,
                                            _ => true,
                                        };
                                    if escape {
                                        return Ok(crate::filters::escape_html(&s));
                                    }
                                    return Ok(s);
                                }
                                Err(e) => return Err(e),
                            }
                        }
                        Expr::Literal(Value::String(s)) => {
                            let mut current = s.clone();
                            for n in &rev_names {
                                match *n {
                                    "upper" => current = current.to_uppercase(),
                                    "lower" => current = current.to_lowercase(),
                                    "trim" => {
                                        current = current
                                            .trim_matches(|c: char| c.is_whitespace())
                                            .to_string();
                                    }
                                    "capitalize" => {
                                        current = crate::filters::capitalize_string_slice(&current);
                                    }
                                    "length" => {
                                        let s = current.chars().count().to_string();
                                        let escape = env.autoescape;
                                        return Ok(if escape {
                                            crate::filters::escape_html(&s)
                                        } else {
                                            s
                                        });
                                    }
                                    _ => unreachable!(),
                                }
                            }
                            let escape = env.autoescape;
                            return Ok(if escape {
                                crate::filters::escape_html(&current)
                            } else {
                                current
                            });
                        }
                        Expr::Literal(Value::Array(a)) if rev_names == ["length"] => {
                            let s = a.len().to_string();
                            let escape = env.autoescape;
                            return Ok(if escape {
                                crate::filters::escape_html(&s)
                            } else {
                                s
                            });
                        }
                        _ => {}
                    }
                }
            }
            if args.is_empty() && !env.custom_filters.contains_key(name) {
                if let Expr::Variable(var_name) = input.as_ref() {
                    let input_v = env.resolve_variable_ref(stack, var_name)?;
                    match name.as_str() {
                        "upper" => {
                            let out =
                                crate::value::value_to_string(input_v.as_ref()).to_uppercase();
                            return if env.autoescape
                                && !crate::value::is_marked_safe(input_v.as_ref())
                            {
                                Ok(crate::filters::escape_html(&out))
                            } else {
                                Ok(out)
                            };
                        }
                        "lower" => {
                            let out =
                                crate::value::value_to_string(input_v.as_ref()).to_lowercase();
                            return if env.autoescape
                                && !crate::value::is_marked_safe(input_v.as_ref())
                            {
                                Ok(crate::filters::escape_html(&out))
                            } else {
                                Ok(out)
                            };
                        }
                        "length" => {
                            let n = match input_v.as_ref() {
                                Value::String(s) => s.chars().count(),
                                Value::Array(a) => a.len(),
                                v if is_undefined_value(v) => 0,
                                v if crate::value::is_marked_safe(v) => crate::value::value_to_string(v).chars().count(),
                                Value::Object(o) => o.len(),
                                _ => 0,
                            };
                            return Ok(n.to_string());
                        }
                        "capitalize" => {
                            let out =
                                crate::filters::chain_capitalize_like_builtin(input_v.as_ref());
                            let s = crate::value::value_to_string(&out);
                            return if env.autoescape
                                && !crate::value::is_marked_safe(input_v.as_ref())
                            {
                                Ok(crate::filters::escape_html(&s))
                            } else {
                                Ok(s)
                            };
                        }
                        _ => {}
                    }
                }
                if let Expr::Literal(Value::String(s)) = input.as_ref() {
                    match name.as_str() {
                        "upper" => {
                            let out = s.to_uppercase();
                            return if env.autoescape {
                                Ok(crate::filters::escape_html(&out))
                            } else {
                                Ok(out)
                            };
                        }
                        "lower" => {
                            let out = s.to_lowercase();
                            return if env.autoescape {
                                Ok(crate::filters::escape_html(&out))
                            } else {
                                Ok(out)
                            };
                        }
                        "length" => {
                            return Ok(s.chars().count().to_string());
                        }
                        "capitalize" => {
                            let out = crate::filters::capitalize_string_slice(s);
                            return if env.autoescape {
                                Ok(crate::filters::escape_html(&out))
                            } else {
                                Ok(out)
                            };
                        }
                        _ => {}
                    }
                }
                if let Expr::Literal(Value::Array(a)) = input.as_ref() {
                    if name == "length" {
                        return Ok(a.len().to_string());
                    }
                }
            }
            let v = eval_to_value(env, state, e, stack)?;
            let s = crate::value::value_to_string(&v);
            if env.autoescape && !crate::value::is_marked_safe(&v) {
                Ok(crate::filters::escape_html(&s))
            } else {
                Ok(s)
            }
        }
        _ => {
            let v = eval_to_value(env, state, e, stack)?;
            let s = crate::value::value_to_string(&v);
            if env.autoescape && !crate::value::is_marked_safe(&v) {
                Ok(crate::filters::escape_html(&s))
            } else {
                Ok(s)
            }
        }
    }
}

fn eval_slice_bound(
    env: &Environment,
    state: &mut RenderState<'_>,
    e: Option<&Expr>,
    stack: &mut CtxStack,
) -> Result<Option<i64>> {
    let Some(e) = e else {
        return Ok(None);
    };
    let v = eval_to_value(env, state, e, stack)?;
    if v.is_null() || crate::value::is_undefined_value(&v) {
        return Ok(None);
    }
    let n = v
        .as_i64()
        .or_else(|| v.as_f64().map(|x| x as i64))
        .or_else(|| crate::value::value_to_string(&v).parse().ok());
    match n {
        Some(x) => Ok(Some(x)),
        None => Err(RunjucksError::new("slice bound must be a number")),
    }
}

fn try_dispatch_builtin(
    state: &mut RenderState<'_>,
    stack: &CtxStack,
    name: &str,
    arg_vals: &[Value],
) -> Option<Result<Value>> {
    crate::render_common::try_dispatch_builtin(
        &mut state.cyclers,
        &mut state.joiners,
        stack.defined(name),
        stack.get_ref(name),
        name,
        arg_vals,
    )
}

fn render_macro_body(
    env: &Environment,
    state: &mut RenderState<'_>,
    m: &MacroDef,
    positional: &[Value],
    kwargs: &[(String, Value)],
    outer: &mut CtxStack,
    module_closure: Option<&HashMap<String, Value>>,
) -> Result<String> {
    let mut inner = outer.flatten();
    let mut origins = outer.flatten_origins();
    let arg_origins = std::mem::take(&mut state.pending_arg_origins);
    if let Some(mc) = module_closure {
        for (k, v) in mc {
            inner.insert(k.clone(), v.clone());
        }
    }
    for p in &m.params {
        let val = if let Some(ref d) = p.default {
            eval_to_value(env, state, d, outer)?
        } else {
            Value::Null
        };
        inner.insert(p.name.clone(), val);
    }
    for p in &m.params {
        origins.remove(&p.name);
    }
    for (i, p) in m.params.iter().enumerate() {
        if let Some(v) = positional.get(i) {
            inner.insert(p.name.clone(), v.clone());
            if let Some(Some(o)) = arg_origins.get(i) {
                origins.insert(p.name.clone(), o.clone());
            }
        }
    }
    for (k, v) in kwargs {
        if m.params.iter().any(|p| p.name == *k) {
            inner.insert(k.clone(), v.clone());
        }
    }
    let mut stack = CtxStack::from_root_with_origins(inner, origins);
    let Some(closure) = &m.closure else {
        return render_children(env, state, &m.body, &mut stack);
    };
    state.macro_closures.push(closure.clone());
    let out = render_children(env, state, &m.body, &mut stack);
    state.macro_closures.pop();
    out
}

/// Renders the `{% call %}` body for `caller()` / `caller(args…)` (Nunjucks `Caller` node).
fn render_caller_invocation(
    env: &Environment,
    state: &mut RenderState<'_>,
    frame: &CallerFrame,
    positional: &[Value],
    kwargs: &[(String, Value)],
    stack: &mut CtxStack,
) -> Result<String> {
    if frame.params.is_empty() {
        if !positional.is_empty() || !kwargs.is_empty() {
            return Err(RunjucksError::new("`caller()` takes no arguments"));
        }
        return render_children(env, state, &frame.body, stack);
    }
    stack.push_frame();
    for p in &frame.params {
        let val = if let Some(ref d) = p.default {
            eval_to_value(env, state, d, stack)?
        } else {
            Value::Null
        };
        stack.set_local(&p.name, val);
    }
    for (i, p) in frame.params.iter().enumerate() {
        if let Some(v) = positional.get(i) {
            stack.set_local(&p.name, v.clone());
        }
    }
    for (k, v) in kwargs {
        if frame.params.iter().any(|p| p.name == *k) {
            stack.set_local(k, v.clone());
        }
    }
    let out = render_children(env, state, &frame.body, stack)?;
    stack.pop_frame();
    Ok(out)
}

fn eval_to_value(
    env: &Environment,
    state: &mut RenderState<'_>,
    e: &Expr,
    stack: &mut CtxStack,
) -> Result<Value> {
    match e {
        Expr::Literal(v) => Ok(v.clone()),
        Expr::Variable(name) => env.resolve_variable(stack, name),
        Expr::Unary { op, expr } => match op {
            UnaryOp::Not => {
                if let Expr::Variable(name) = expr.as_ref() {
                    let v = env.resolve_variable_ref(stack, name)?;
                    return Ok(Value::Bool(!is_truthy(v.as_ref())));
                }
                let v = eval_to_value(env, state, expr, stack)?;
                Ok(Value::Bool(!is_truthy(&v)))
            }
            UnaryOp::Neg => {
                if let Expr::Variable(name) = expr.as_ref() {
                    let v = env.resolve_variable_ref(stack, name)?;
                    let n = as_number(v.as_ref())
                        .ok_or_else(|| RunjucksError::new("unary '-' expects a numeric value"))?;
                    return Ok(json_num(-n));
                }
                let v = eval_to_value(env, state, expr, stack)?;
                let n = as_number(&v)
                    .ok_or_else(|| RunjucksError::new("unary '-' expects a numeric value"))?;
                Ok(json_num(-n))
            }
            UnaryOp::Pos => {
                if let Expr::Variable(name) = expr.as_ref() {
                    let v = env.resolve_variable_ref(stack, name)?;
                    if let Some(n) = as_number(v.as_ref()) {
                        return Ok(json_num(n));
                    }
                    return Ok(v.into_owned());
                }
                let v = eval_to_value(env, state, expr, stack)?;
                Ok(v)
            }
        },
        Expr::Binary { op, left, right } => match op {
            BinOp::Add => Ok(add_like_js(
                &eval_to_value(env, state, left, stack)?,
                &eval_to_value(env, state, right, stack)?,
            )),
            BinOp::Concat => Ok(Value::String(format!(
                "{}{}",
                eval_for_output(env, state, left, stack)?,
                eval_for_output(env, state, right, stack)?
            ))),
            BinOp::Sub => {
                let a = eval_to_value(env, state, left, stack)?;
                let b = eval_to_value(env, state, right, stack)?;
                let x = as_number(&a).ok_or_else(|| RunjucksError::new("`-` expects numbers"))?;
                let y = as_number(&b).ok_or_else(|| RunjucksError::new("`-` expects numbers"))?;
                Ok(json_num(x - y))
            }
            BinOp::Mul => {
                let a = eval_to_value(env, state, left, stack)?;
                let b = eval_to_value(env, state, right, stack)?;
                let x = as_number(&a).ok_or_else(|| RunjucksError::new("`*` expects numbers"))?;
                let y = as_number(&b).ok_or_else(|| RunjucksError::new("`*` expects numbers"))?;
                Ok(json_num(x * y))
            }
            BinOp::Div => {
                let a = eval_to_value(env, state, left, stack)?;
                let b = eval_to_value(env, state, right, stack)?;
                let x = as_number(&a).ok_or_else(|| RunjucksError::new("`/` expects numbers"))?;
                let y = as_number(&b).ok_or_else(|| RunjucksError::new("`/` expects numbers"))?;
                Ok(json!(x / y))
            }
            BinOp::FloorDiv => {
                let a = eval_to_value(env, state, left, stack)?;
                let b = eval_to_value(env, state, right, stack)?;
                let x = as_number(&a).ok_or_else(|| RunjucksError::new("`//` expects numbers"))?;
                let y = as_number(&b).ok_or_else(|| RunjucksError::new("`//` expects numbers"))?;
                if y == 0.0 {
                    return Err(RunjucksError::new("division by zero"));
                }
                Ok(json_num((x / y).floor()))
            }
            BinOp::Mod => {
                let a = eval_to_value(env, state, left, stack)?;
                let b = eval_to_value(env, state, right, stack)?;
                let x = as_number(&a).ok_or_else(|| RunjucksError::new("`%` expects numbers"))?;
                let y = as_number(&b).ok_or_else(|| RunjucksError::new("`%` expects numbers"))?;
                Ok(json_num(x % y))
            }
            BinOp::Pow => {
                let a = eval_to_value(env, state, left, stack)?;
                let b = eval_to_value(env, state, right, stack)?;
                let x = as_number(&a).ok_or_else(|| RunjucksError::new("`**` expects numbers"))?;
                let y = as_number(&b).ok_or_else(|| RunjucksError::new("`**` expects numbers"))?;
                Ok(json!(x.powf(y)))
            }
            BinOp::And => {
                let l = eval_to_value(env, state, left, stack)?;
                if !is_truthy(&l) {
                    return Ok(l);
                }
                eval_to_value(env, state, right, stack)
            }
            BinOp::Or => {
                let l = eval_to_value(env, state, left, stack)?;
                if is_truthy(&l) {
                    return Ok(l);
                }
                eval_to_value(env, state, right, stack)
            }
            BinOp::In => {
                let key = eval_to_value(env, state, left, stack)?;
                let container = eval_to_value(env, state, right, stack)?;
                Ok(Value::Bool(eval_in(&key, &container)?))
            }
            BinOp::Is => {
                let (test_name, arg_exprs) = is_test_parts(right).ok_or_else(|| {
                    RunjucksError::new("`is` test must be an identifier, call, string, or null")
                })?;
                if test_name == "defined" {
                    if let Expr::Variable(n) = &**left {
                        return Ok(Value::Bool(stack.defined(n)));
                    }
                }
                if test_name == "callable" {
                    if let Expr::Variable(n) = &**left {
                        if state.lookup_macro(n).is_some() {
                            return Ok(Value::Bool(true));
                        }
                    }
                }
                if arg_exprs.is_empty() {
                    let v = match &**left {
                        Expr::Variable(n) => env.resolve_variable_ref(stack, n)?,
                        _ => Cow::Owned(eval_to_value(env, state, left, stack)?),
                    };
                    return Ok(Value::Bool(env.apply_is_test(
                        test_name,
                        v.as_ref(),
                        &[],
                    )?));
                }
                let arg_vals: Vec<Value> = arg_exprs
                    .iter()
                    .map(|e| eval_to_value(env, state, e, stack))
                    .collect::<Result<_>>()?;
                let v = match &**left {
                    Expr::Variable(n) => env.resolve_variable_ref(stack, n)?,
                    _ => Cow::Owned(eval_to_value(env, state, left, stack)?),
                };
                if matches!(test_name, "equalto" | "eq" | "sameas") && arg_exprs.len() == 1 {
                    if let Expr::Variable(lhs) = &**left {
                        if let Expr::Variable(rhs) = &arg_exprs[0] {
                            if lhs == rhs {
                                return Ok(Value::Bool(true));
                            }
                        }
                    }
                    if is_reference_value(v.as_ref()) && is_reference_value(&arg_vals[0]) {
                        let v_owned = v.into_owned();
                        let lo = origin_of(env, state, left, stack)?;
                        let ro = origin_of(env, state, &arg_exprs[0], stack)?;
                        return Ok(Value::Bool(match (lo, ro) {
                            (Some(a), Some(b)) => a == b,
                            _ => v_owned == arg_vals[0],
                        }));
                    }
                }
                Ok(Value::Bool(env.apply_is_test(
                    test_name,
                    v.as_ref(),
                    &arg_vals,
                )?))
            }
        },
        Expr::Compare { head, rest } => {
            if rest.len() == 1 {
                let (op, rhs_e) = &rest[0];
                match head.as_ref() {
                    Expr::Variable(n) => {
                        // RHS first: `resolve_variable_ref` borrows `stack` immutably while
                        // `eval_to_value` needs `&mut` — evaluate RHS before LHS (same result for
                        // pure compare expressions).
                        let r = eval_to_value(env, state, rhs_e, stack)?;
                        let left = env.resolve_variable_ref(stack, n)?;
                        return Ok(Value::Bool(compare_values(left.as_ref(), *op, &r)));
                    }
                    _ => {
                        let left = eval_to_value(env, state, head, stack)?;
                        let r = eval_to_value(env, state, rhs_e, stack)?;
                        return Ok(Value::Bool(compare_values(&left, *op, &r)));
                    }
                }
            }
            let mut acc = eval_to_value(env, state, head, stack)?;
            for (op, rhs_e) in rest.iter() {
                let r = eval_to_value(env, state, rhs_e, stack)?;
                let ok = compare_values(&acc, *op, &r);
                acc = Value::Bool(ok);
            }
            Ok(acc)
        }
        Expr::InlineIf {
            cond,
            then_expr,
            else_expr,
        } => {
            let c = eval_to_value(env, state, cond, stack)?;
            if is_truthy(&c) {
                eval_to_value(env, state, then_expr, stack)
            } else if let Some(els) = else_expr {
                eval_to_value(env, state, els, stack)
            } else {
                // Nunjucks compiles `a if b` to `b ? a : ""`.
                Ok(Value::String(String::new()))
            }
        }
        Expr::GetAttr { base, attr } => {
            if let Expr::Variable(ns) = base.as_ref() {
                if state.macro_namespaces.contains_key(ns)
                    || state.macro_namespace_values.contains_key(ns)
                {
                    if let Some(v) = state.lookup_namespaced_value(ns, attr) {
                        return Ok(v.clone());
                    }
                    if state.lookup_namespaced_macro(ns, attr).is_some() {
                        let mut m = Map::new();
                        m.insert(RJ_CALLABLE.to_string(), Value::Bool(true));
                        return Ok(Value::Object(m));
                    }
                    return Ok(undefined_value());
                }
            }
            if let Some((root_name, attrs)) = collect_attr_chain_from_getattr(e) {
                if !state.macro_namespaces.contains_key(root_name)
                    && !state.macro_namespace_values.contains_key(root_name)
                {
                    let mut cur = env.resolve_variable_ref(stack, root_name)?;
                    for a in &attrs {
                        if is_undefined_value(cur.as_ref()) || cur.as_ref().is_null() {
                            return Ok(undefined_value());
                        }
                        cur = Cow::Owned(value_attr(cur.as_ref(), a));
                    }
                    return Ok(cur.into_owned());
                }
            }
            let b = eval_to_value(env, state, base, stack)?;
            if is_undefined_value(&b) || b.is_null() {
                return Ok(undefined_value());
            }
            Ok(value_attr(&b, attr))
        }
        Expr::GetItem { base, index } => match index.as_ref() {
            Expr::Slice {
                start: s,
                stop: st,
                step: step_e,
            } => {
                let start_v = eval_slice_bound(env, state, s.as_deref(), stack)?;
                let stop_v = eval_slice_bound(env, state, st.as_deref(), stack)?;
                let step_v = eval_slice_bound(env, state, step_e.as_deref(), stack)?;
                if let Expr::Variable(name) = base.as_ref() {
                    let base_val = env.resolve_variable_ref(stack, name)?;
                    if is_undefined_value(base_val.as_ref()) || base_val.as_ref().is_null() {
                        return Ok(undefined_value());
                    }
                    if let Value::Array(a) = base_val.as_ref() {
                        return Ok(Value::Array(jinja_slice_array(a, start_v, stop_v, step_v)));
                    }
                    return Ok(Value::Null);
                }
                let b = eval_to_value(env, state, base, stack)?;
                if is_undefined_value(&b) || b.is_null() {
                    return Ok(undefined_value());
                }
                let Value::Array(a) = &b else {
                    return Ok(Value::Null);
                };
                Ok(Value::Array(jinja_slice_array(a, start_v, stop_v, step_v)))
            }
            idx_e => {
                if let Expr::Variable(name) = base.as_ref() {
                    let base_val = env.resolve_variable_ref(stack, name)?;
                    if is_undefined_value(base_val.as_ref()) || base_val.as_ref().is_null() {
                        return Ok(undefined_value());
                    }
                    match idx_e {
                        Expr::Literal(Value::Number(n)) => {
                            let idx = n
                                .as_u64()
                                .or_else(|| n.as_f64().map(|x| x as u64))
                                .unwrap_or(0) as usize;
                            match base_val.as_ref() {
                                Value::Array(a) => {
                                    return Ok(a.get(idx).cloned().unwrap_or_else(undefined_value));
                                }
                                _ => return Ok(undefined_value()),
                            }
                        }
                        Expr::Literal(Value::String(k)) => match base_val.as_ref() {
                            Value::Object(o) => {
                                return Ok(o.get(k).cloned().unwrap_or_else(undefined_value));
                            }
                            _ => return Ok(undefined_value()),
                        },
                        _ => {}
                    }
                }
                let b = eval_to_value(env, state, base, stack)?;
                if is_undefined_value(&b) || b.is_null() {
                    return Ok(undefined_value());
                }
                let i = eval_to_value(env, state, idx_e, stack)?;
                match (&b, &i) {
                    (Value::Array(a), Value::Number(n)) => {
                        let idx = n
                            .as_u64()
                            .or_else(|| n.as_f64().map(|x| x as u64))
                            .unwrap_or(0) as usize;
                        Ok(a.get(idx).cloned().unwrap_or_else(undefined_value))
                    }
                    (Value::Object(o), Value::String(k)) => {
                        Ok(o.get(k).cloned().unwrap_or_else(undefined_value))
                    }
                    _ => Ok(undefined_value()),
                }
            }
        },
        Expr::Slice { .. } => Err(RunjucksError::new(
            "slice expression is only valid inside `[ ]`",
        )),
        Expr::Call {
            callee,
            args,
            kwargs,
        } => {
            let arg_vals: Vec<Value> = args
                .iter()
                .map(|a| eval_to_value(env, state, a, stack))
                .collect::<Result<_>>()?;
            let kw_vals: Vec<(String, Value)> = kwargs
                .iter()
                .map(|(k, e)| Ok((k.clone(), eval_to_value(env, state, e, stack)?)))
                .collect::<Result<_>>()?;
            if let Expr::GetAttr { base, attr } = callee.as_ref() {
                if attr == "test" {
                    let base_v = eval_to_value(env, state, base, stack)?;
                    if crate::value::is_regexp_value(&base_v) {
                        if !kw_vals.is_empty() {
                            return Err(RunjucksError::new(
                                "regex `.test` does not accept keyword arguments",
                            ));
                        }
                        if arg_vals.len() != 1 {
                            return Err(RunjucksError::new(
                                "regex `.test` expects exactly one argument",
                            ));
                        }
                        let Some((pat, fl)) = crate::value::regexp_pattern_flags(&base_v) else {
                            return Err(RunjucksError::new("invalid regex value"));
                        };
                        let s = crate::value::value_to_string(&arg_vals[0]);
                        return Ok(Value::Bool(crate::js_regex::regexp_test(&pat, &fl, &s)?));
                    }
                }
            }
            if let Expr::GetAttr { base, attr } = callee.as_ref() {
                if attr == "next" && arg_vals.is_empty() && kw_vals.is_empty() {
                    let b = eval_to_value(env, state, base, stack)?;
                    if let Some(id) = parse_cycler_id(&b) {
                        if let Some(c) = state.cyclers.get_mut(id) {
                            return Ok(c.next());
                        }
                        return Ok(Value::Null);
                    }
                }
            }
            if let Expr::Variable(name) = callee.as_ref() {
                if name == "super" {
                    if !args.is_empty() || !kw_vals.is_empty() {
                        return Err(RunjucksError::new("`super()` takes no arguments"));
                    }
                    let (block_name, layer) = state.super_context.clone().ok_or_else(|| {
                        RunjucksError::new("`super()` is only valid inside a `{% block %}`")
                    })?;
                    let (body_to_render, next) = {
                        let chains = state.block_chains.as_ref().ok_or_else(|| {
                            RunjucksError::new(
                                "`super()` requires template inheritance (`{% extends %}`)",
                            )
                        })?;
                        let chain = chains.get(&block_name).ok_or_else(|| {
                            RunjucksError::new(format!(
                                "no super block available for `{block_name}`"
                            ))
                        })?;
                        let next = layer + 1;
                        if next >= chain.len() {
                            return Err(RunjucksError::new(
                                "no parent block available for `super()`",
                            ));
                        }
                        (chain[next].clone(), next)
                    };
                    let prev = state.super_context.replace((block_name.clone(), next));
                    let s = render_children(env, state, &body_to_render, stack)?;
                    state.super_context = prev;
                    return Ok(mark_safe(s));
                }
                if name == "caller" {
                    let frame = state.caller_stack.last().cloned().ok_or_else(|| {
                        RunjucksError::new(
                            "`caller()` is only valid inside a macro invoked from `{% call %}`",
                        )
                    })?;
                    let s =
                        render_caller_invocation(env, state, &frame, &arg_vals, &kw_vals, stack)?;
                    return Ok(mark_safe(s));
                }
                if let Some(mdef) = state.lookup_macro(name).cloned() {
                    let mut arg_origins = Vec::with_capacity(args.len());
                    for (a, v) in args.iter().zip(&arg_vals) {
                        arg_origins.push(if is_reference_value(v) { origin_of(env, state, a, stack)? } else { None });
                    }
                    state.pending_arg_origins = arg_origins;
                    let s = render_macro_body(env, state, &mdef, &arg_vals, &kw_vals, stack, None)?;
                    return Ok(mark_safe(s));
                }
                if arg_vals.is_empty() {
                    let v = env.resolve_variable(stack, name)?;
                    if let Some(id) = parse_joiner_id(&v) {
                        if let Some(j) = state.joiners.get_mut(id) {
                            return Ok(Value::String(j.invoke()));
                        }
                    }
                }
                if let Some(r) = try_dispatch_builtin(state, stack, name, &arg_vals) {
                    return r;
                }
                if let Some(f) = env.custom_globals.get(name) {
                    return f(&arg_vals, &kw_vals);
                }
                #[cfg(feature = "async")]
                if env.async_custom_globals.contains_key(name) {
                    return Err(RunjucksError::new(format!(
                        "`{name}` is an async global and can only be used with `renderStringAsync()` or `renderTemplateAsync()`"
                    )));
                }
            }
            if let Expr::GetAttr { base, attr } = callee.as_ref() {
                if let Expr::Variable(ns) = base.as_ref() {
                    if let Some(mdef) = state.lookup_namespaced_macro(ns, attr).cloned() {
                        let mc = state.macro_namespace_values.get(ns).cloned();
                        let s = render_macro_body(
                            env,
                            state,
                            &mdef,
                            &arg_vals,
                            &kw_vals,
                            stack,
                            mc.as_ref(),
                        )?;
                        return Ok(mark_safe(s));
                    }
                }
            }
            if let Expr::GetAttr { base, attr } = callee.as_ref() {
                if kw_vals.is_empty() {
                    let b = eval_to_value(env, state, base, stack)?;
                    // `list.push(x)` on a template variable mutates that binding, as the JS array
                    // reference does in Nunjucks; it returns the new length.
                    if attr == "push" {
                        if let (Expr::Variable(name), Value::Array(items)) = (base.as_ref(), &b) {
                            let mut items = items.clone();
                            items.extend(arg_vals.iter().cloned());
                            let len = items.len();
                            stack.set(name, Value::Array(items));
                            return Ok(Value::from(len));
                        }
                    }
                    if let Some(r) = crate::js_methods::call(&b, attr, &arg_vals) {
                        return r;
                    }
                }
            }
            Err(RunjucksError::new(
                "only template macros, built-in globals (`range`, `cycler`, `joiner`), registered global callables, or `super`/`caller` are supported for `()` expressions",
            ))
        }
        Expr::Filter { name, input, args } => {
            if args.is_empty() {
                if let Some(r) = try_apply_peeled_builtin_filter_chain_value(env, stack, e) {
                    return r;
                }
            }
            #[cfg(feature = "async")]
            let async_override = env.async_custom_filters.contains_key(name);
            #[cfg(not(feature = "async"))]
            let async_override = false;
            if args.is_empty() && !env.custom_filters.contains_key(name) && !async_override {
                if let Expr::Variable(var_name) = input.as_ref() {
                    let input_v = env.resolve_variable_ref(stack, var_name)?;
                    match name.as_str() {
                        "upper" => {
                            return Ok(Value::String(
                                crate::value::value_to_string(input_v.as_ref()).to_uppercase(),
                            ));
                        }
                        "lower" => {
                            return Ok(Value::String(
                                crate::value::value_to_string(input_v.as_ref()).to_lowercase(),
                            ));
                        }
                        "length" => {
                            return Ok(match input_v.as_ref() {
                                Value::String(s) => json!(s.chars().count()),
                                Value::Array(a) => json!(a.len()),
                                v if is_undefined_value(v) => json!(0),
                                v if crate::value::is_marked_safe(v) => json!(crate::value::value_to_string(v).chars().count()),
                                Value::Object(o) => json!(o.len()),
                                _ => json!(0),
                            });
                        }
                        "capitalize" => {
                            return Ok(crate::filters::chain_capitalize_like_builtin(
                                input_v.as_ref(),
                            ));
                        }
                        _ => {}
                    }
                }
                if let Expr::Literal(Value::String(s)) = input.as_ref() {
                    match name.as_str() {
                        "upper" => return Ok(Value::String(s.to_uppercase())),
                        "lower" => return Ok(Value::String(s.to_lowercase())),
                        "length" => return Ok(json!(s.chars().count())),
                        "capitalize" => {
                            return Ok(Value::String(crate::filters::capitalize_string_slice(s)));
                        }
                        _ => {}
                    }
                }
                if let Expr::Literal(Value::Array(a)) = input.as_ref() {
                    if name == "length" {
                        return Ok(json!(a.len()));
                    }
                }
            }
            #[cfg(feature = "async")]
            if env.async_custom_filters.contains_key(name) {
                return Err(RunjucksError::new(format!(
                    "`{name}` is an async filter and can only be used with `renderStringAsync()` or `renderTemplateAsync()`"
                )));
            }
            let input_v = eval_to_value(env, state, input, stack)?;
            let arg_vals: Vec<Value> = args
                .iter()
                .map(|a| eval_to_value(env, state, a, stack))
                .collect::<Result<_>>()?;
            crate::filters::apply_builtin(env, &mut state.rng, name, &input_v, &arg_vals)
        }
        Expr::List(items) => {
            let mut out = Vec::with_capacity(items.len());
            for it in items {
                out.push(eval_to_value(env, state, it, stack)?);
            }
            Ok(Value::Array(out))
        }
        Expr::Dict(pairs) => {
            use serde_json::Map;
            let mut m = Map::new();
            for (k, v) in pairs {
                let key_v = eval_to_value(env, state, k, stack)?;
                let key = match key_v {
                    Value::String(s) => s,
                    _ => crate::value::value_to_string(&key_v),
                };
                m.insert(key, eval_to_value(env, state, v, stack)?);
            }
            Ok(Value::Object(m))
        }
        Expr::RegexLiteral { pattern, flags } => {
            let mut m = Map::new();
            m.insert(crate::value::RJ_REGEXP.to_string(), Value::Bool(true));
            m.insert("pattern".to_string(), Value::String(pattern.clone()));
            m.insert("flags".to_string(), Value::String(flags.clone()));
            Ok(Value::Object(m))
        }
    }
}

/// JS-style attribute lookup: object keys, `SafeString.val`, and `.length` on arrays/strings.
fn value_attr(v: &Value, attr: &str) -> Value {
    match v {
        Value::Object(o) if crate::value::is_marked_safe(v) => match attr {
            "val" => o.get(crate::value::RJ_SAFE).cloned().unwrap_or_else(undefined_value),
            "length" => json!(crate::value::value_to_string(v).chars().count()),
            _ => undefined_value(),
        },
        _ if is_undefined_value(v) => undefined_value(),
        Value::Object(o) => o.get(attr).cloned().unwrap_or_else(undefined_value),
        Value::Array(a) if attr == "length" => json!(a.len()),
        Value::String(s) if attr == "length" => json!(s.chars().count()),
        _ => undefined_value(),
    }
}
