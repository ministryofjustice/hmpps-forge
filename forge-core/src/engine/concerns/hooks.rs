//! Hooks (port of `concerns/hooks`): access lifecycles that can halt a request before anything
//! else runs, and submit lifecycles that gate, run effects, validate and branch on POST.

use std::sync::Arc;

use crate::engine::ast::{Node, NodeKind, OutcomeKind, Prop};
use crate::engine::errors::{ForgeError, ForgeResult};
use crate::engine::expr::{Call, ExprCompiler, Expr, Scope};
use crate::engine::registries::FunctionEntry;
use crate::engine::runtime::context::{EffectContext, HookType};
use crate::engine::runtime::pipeline::{PhaseOutput, RequestState};
use crate::engine::tracing::{fields, Span};
use crate::value::Value;

/// A hook `next` outcome (`HookOutcomeModel`).
enum Outcome {
    Redirect { when: Option<Expr>, goto: Goto },
    Error { when: Option<Expr>, status: u16, message: Message },
}

enum Goto {
    Static(String),
    Dynamic(Expr),
}

enum Message {
    Static(String),
    Dynamic(Expr),
}

enum NextResult {
    Redirect(String),
    Error { status: u16, message: String },
}

struct Effect {
    entry: Arc<FunctionEntry>,
    args: Vec<Expr>,
}

struct AccessHook {
    when: Option<Expr>,
    effects: Vec<Effect>,
    outcomes: Vec<Outcome>,
}

struct Branch {
    effects: Vec<Effect>,
    outcomes: Vec<Outcome>,
}

impl Branch {
    fn is_empty(&self) -> bool {
        self.effects.is_empty() && self.outcomes.is_empty()
    }
}

struct SubmitHook {
    when: Option<Expr>,
    guards: Option<Expr>,
    validate: bool,
    groups: Vec<String>,
    on_always: Option<Branch>,
    on_valid: Option<Branch>,
    on_invalid: Option<Branch>,
}

/// The compiled access lifecycle (hooks root-first from the journey tree).
pub struct CompiledAccessLifecycle {
    hooks: Vec<AccessHook>,
}

/// The compiled submit hooks of one step.
pub struct CompiledSubmitHooks {
    hooks: Vec<SubmitHook>,
}

fn compile_effects(exprs: &ExprCompiler<'_>, prop: Option<&Prop>) -> ForgeResult<Vec<Effect>> {
    let mut out = Vec::new();
    for item in prop.and_then(Prop::as_array).unwrap_or_default() {
        let Some(node) = item.as_node().filter(|n| n.expr_kind() == Some(crate::engine::ast::ExprKind::Effect)) else {
            continue;
        };
        let Call { entry, args, .. } = exprs.call(node, None)?;
        out.push(Effect { entry, args });
    }
    Ok(out)
}

fn compile_outcomes(exprs: &ExprCompiler<'_>, prop: Option<&Prop>) -> ForgeResult<Vec<Outcome>> {
    let mut out = Vec::new();
    for item in prop.and_then(Prop::as_array).unwrap_or_default() {
        let Some(node) = item.as_node() else { continue };
        let when = node.node_prop("when").map(|w| exprs.node(w)).transpose()?;
        match node.kind {
            NodeKind::Outcome(OutcomeKind::Redirect) => out.push(Outcome::Redirect {
                when,
                goto: match node.prop("goto") {
                    Some(Prop::Lit(Value::String(s))) => Goto::Static(s.to_string()),
                    other => Goto::Dynamic(exprs.operand_opt(other)?),
                },
            }),
            NodeKind::Outcome(OutcomeKind::ThrowError) => out.push(Outcome::Error {
                when,
                status: node.prop("status").and_then(Prop::as_lit).and_then(Value::as_f64).unwrap_or(500.0) as u16,
                message: match node.prop("message") {
                    Some(Prop::Lit(Value::String(s))) => Message::Static(s.to_string()),
                    other => Message::Dynamic(exprs.operand_opt(other)?),
                },
            }),
            _ => {}
        }
    }
    Ok(out)
}

fn compile_branch(exprs: &ExprCompiler<'_>, prop: Option<&Prop>) -> ForgeResult<Option<Branch>> {
    let Some(b) = prop.and_then(Prop::as_object) else { return Ok(None) };
    Ok(Some(Branch { effects: compile_effects(exprs, b.get("effects"))?, outcomes: compile_outcomes(exprs, b.get("next"))? }))
}

impl CompiledAccessLifecycle {
    /// `HookAnalyzer.resolveAccessHooks`: `onAccess` of every ancestor journey/step, root-first.
    pub fn compile(chain_root_first: &[Arc<Node>], exprs: &ExprCompiler<'_>) -> ForgeResult<Self> {
        let mut hooks = Vec::new();
        for node in chain_root_first.iter().filter(|n| matches!(n.kind, NodeKind::Journey | NodeKind::Step)) {
            for hook in node.children("onAccess") {
                hooks.push(AccessHook {
                    when: hook.node_prop("when").map(|w| exprs.node(w)).transpose()?,
                    effects: compile_effects(exprs, hook.prop("effects"))?,
                    outcomes: compile_outcomes(exprs, hook.prop("next"))?,
                });
            }
        }
        Ok(Self { hooks })
    }

    /// `request.access`: the `access.lifecycle` unit, hooks first-match on a halting outcome.
    pub async fn run(&self, state: &mut RequestState, phase: &Span) -> ForgeResult<PhaseOutput> {
        let lifecycle = phase.open("access-lifecycle", "access.lifecycle");
        for (index, hook) in self.hooks.iter().enumerate() {
            let key = format!("access-hook-{index}");
            let span = lifecycle.open(&key, "access.hook");
            let (executed, result) = run_access_hook(hook, &key, state, &span).await?;
            let outcome = match &result {
                None => "continue",
                Some(NextResult::Redirect(_)) => "redirect",
                Some(NextResult::Error { .. }) => "error",
            };
            span.complete(|| fields([("executed", Value::Bool(executed)), ("outcome", Value::from(outcome))]));
            match result {
                Some(NextResult::Redirect(target)) => {
                    lifecycle.done();
                    return Ok(PhaseOutput::Redirect(target));
                }
                Some(NextResult::Error { status, message }) => {
                    lifecycle.done();
                    let message = if message.is_empty() { "Access denied".to_string() } else { message };
                    return Ok(PhaseOutput::Error { status, message });
                }
                None => {}
            }
        }
        lifecycle.done();
        Ok(PhaseOutput::Continue)
    }
}

/// Runs one access hook's stages (`when` → effects → `next`). `Ok(None)` is a continue.
async fn run_access_hook(
    hook: &AccessHook,
    key: &str,
    state: &mut RequestState,
    span: &Span,
) -> ForgeResult<(bool, Option<NextResult>)> {
    let mut scope = Scope::new(state.ctx.clone());
    if let Some(w) = &hook.when {
        let when = span.open(format!("{key}-when"), "access.hook.when");
        let holds = w.eval(&mut scope).await?.truthy();
        when.done();
        if !holds {
            return Ok((false, None));
        }
    }
    run_effects(&hook.effects, state, HookType::Access, span, key).await?;
    if hook.outcomes.is_empty() {
        return Ok((true, None));
    }
    let next = span.open("next", "access.hook.next");
    let result = run_next(&hook.outcomes, &mut Scope::new(state.ctx.clone())).await?;
    next.complete(|| {
        let outcome = match &result {
            None => "continue",
            Some(NextResult::Redirect(_)) => "redirect",
            Some(NextResult::Error { .. }) => "error",
        };
        fields([("executed", Value::Bool(true)), ("outcome", Value::from(outcome))])
    });
    Ok((true, result))
}

impl CompiledSubmitHooks {
    pub fn compile(step: &Arc<Node>, exprs: &ExprCompiler<'_>) -> ForgeResult<Self> {
        let mut hooks = Vec::new();
        for hook in step.children("onSubmission") {
            let groups: Vec<String> = hook
                .prop("validationGroups")
                .and_then(Prop::as_array)
                .unwrap_or_default()
                .iter()
                .filter_map(|p| p.as_lit().map(Value::to_js_string))
                .collect();
            hooks.push(SubmitHook {
                when: hook.node_prop("when").map(|w| exprs.node(w)).transpose()?,
                guards: hook.node_prop("guards").map(|w| exprs.node(w)).transpose()?,
                validate: hook.prop("validate").and_then(Prop::as_lit).is_some_and(Value::truthy),
                groups: if groups.is_empty() { vec!["default".into()] } else { groups },
                on_always: compile_branch(exprs, hook.prop("onAlways"))?.filter(|b| !b.is_empty()),
                on_valid: compile_branch(exprs, hook.prop("onValid"))?.filter(|b| !b.is_empty()),
                on_invalid: compile_branch(exprs, hook.prop("onInvalid"))?.filter(|b| !b.is_empty()),
            });
        }
        Ok(Self { hooks })
    }

    /// `request.submit`: the `submit.lifecycle` unit; the first hook that executes decides.
    pub async fn run(&self, state: &mut RequestState, phase: &Span) -> ForgeResult<PhaseOutput> {
        let lifecycle = phase.open("submit-lifecycle", "submit.lifecycle");
        for (index, hook) in self.hooks.iter().enumerate() {
            let key = format!("submit-hook-{index}");
            let span = lifecycle.open(&key, "submit.hook");
            let (result, validated) = run_submit_hook(hook, &key, state, &span).await?;
            span.complete(|| {
                let (executed, outcome) = match &result {
                    SubmitResult::NotExecuted => (false, "continue"),
                    SubmitResult::Continue => (true, "continue"),
                    SubmitResult::Halt(NextResult::Redirect(_)) => (true, "redirect"),
                    SubmitResult::Halt(NextResult::Error { .. }) => (true, "error"),
                };
                let is_valid = match validated {
                    Validated::No => Value::Undefined,
                    Validated::Yes(v) => Value::Bool(v),
                };
                fields([
                    ("executed", Value::Bool(executed)),
                    ("validated", Value::Bool(!matches!(validated, Validated::No))),
                    ("isValid", is_valid),
                    ("outcome", Value::from(outcome)),
                ])
            });
            let output = match result {
                SubmitResult::NotExecuted => continue,
                SubmitResult::Continue => PhaseOutput::Continue,
                SubmitResult::Halt(NextResult::Redirect(target)) => PhaseOutput::Redirect(target),
                SubmitResult::Halt(NextResult::Error { status, message }) => {
                    let message = if message.is_empty() { "Submission error".to_string() } else { message };
                    PhaseOutput::Error { status, message }
                }
            };
            lifecycle.done();
            return Ok(output);
        }
        lifecycle.done();
        Ok(PhaseOutput::Continue)
    }
}

enum SubmitResult {
    NotExecuted,
    Continue,
    Halt(NextResult),
}

/// Whether the hook's result carries a validity (`validated` / `isValid`).
#[derive(Clone, Copy)]
enum Validated {
    No,
    Yes(bool),
}

/// One submit hook's stages: when → guards → onAlways → validation → onValid → onInvalid.
async fn run_submit_hook(
    hook: &SubmitHook,
    key: &str,
    state: &mut RequestState,
    span: &Span,
) -> ForgeResult<(SubmitResult, Validated)> {
    for (gate, name) in [(&hook.when, "when"), (&hook.guards, "guards")] {
        let Some(gate) = gate else { continue };
        let stage = span.child(format!("{key}-{name}"), "submit.predicate", || fields([("name", Value::from(name))]));
        let passed = gate.eval(&mut Scope::new(state.ctx.clone())).await?.truthy();
        stage.complete(|| fields([("passed", Value::Bool(passed))]));
        if !passed {
            return Ok((SubmitResult::NotExecuted, Validated::No));
        }
    }
    if let Some(b) = &hook.on_always
        && let Some(result) = run_branch(b, &format!("{key}-onAlways"), "onAlways", state, span).await?
    {
        return Ok((SubmitResult::Halt(result), Validated::No));
    }
    if hook.validate {
        state.validate_current_step(&hook.groups, true, span, &format!("{key}-validation")).await?;
    }
    let valid = state.current_page_validation.as_ref().is_none_or(|v| v.is_valid);
    let validated = if hook.validate { Validated::Yes(valid) } else { Validated::No };
    for (branch, name, selected) in [(&hook.on_valid, "onValid", valid), (&hook.on_invalid, "onInvalid", !valid)] {
        let Some(b) = branch else { continue };
        if !selected {
            // An unselected branch runs nothing and drops its own unit.
            span.child(format!("{key}-{name}"), "submit.branch", || fields([("name", Value::from(name))])).omit();
            continue;
        }
        if let Some(result) = run_branch(b, &format!("{key}-{name}"), name, state, span).await? {
            return Ok((SubmitResult::Halt(result), Validated::Yes(name == "onValid")));
        }
    }
    Ok((SubmitResult::Continue, validated))
}

/// A selected submit branch (`submit.branch`): its effects, then `next()`.
async fn run_branch(
    branch: &Branch,
    key: &str,
    name: &str,
    state: &mut RequestState,
    parent: &Span,
) -> ForgeResult<Option<NextResult>> {
    let span = parent.child(key, "submit.branch", || fields([("name", Value::from(name))]));
    run_effects(&branch.effects, state, HookType::Submit, &span, key).await?;
    let result = run_next(&branch.outcomes, &mut Scope::new(state.ctx.clone())).await?;
    span.complete(|| {
        let outcome = match &result {
            None => "continue",
            Some(NextResult::Redirect(_)) => "redirect",
            Some(NextResult::Error { .. }) => "error",
        };
        fields([("name", Value::from(name)), ("outcome", Value::from(outcome))])
    });
    Ok(result)
}

/// Runs effects in order, each as a `hook.effect` unit keyed `<prefix>-effect-<n>`.
async fn run_effects(
    effects: &[Effect],
    state: &mut RequestState,
    hook_type: HookType,
    hook: &Span,
    prefix: &str,
) -> ForgeResult<()> {
    for (index, effect) in effects.iter().enumerate() {
        let span = hook.child(format!("{prefix}-effect-{index}"), "hook.effect", || {
            fields([("name", Value::String(effect.entry.name.clone()))])
        });
        let mut scope = Scope::new(state.ctx.clone());
        let mut args = Vec::with_capacity(effect.args.len());
        for a in &effect.args {
            args.push(a.eval(&mut scope).await?);
        }
        let ctx = EffectContext::new(state.ctx.clone(), state.response.clone(), hook_type);
        effect.entry.run_effect(ctx, args).await?;
        span.done();
    }
    Ok(())
}

/// The compiled `next()` function: the first outcome whose `when` holds and whose target
/// resolves wins.
async fn run_next(outcomes: &[Outcome], scope: &mut Scope) -> ForgeResult<Option<NextResult>> {
    for outcome in outcomes {
        let when = match outcome {
            Outcome::Redirect { when, .. } | Outcome::Error { when, .. } => when,
        };
        if let Some(w) = when
            && !w.eval(scope).await?.truthy()
        {
            continue;
        }
        match outcome {
            Outcome::Redirect { goto: Goto::Static(g), .. } => return Ok(Some(NextResult::Redirect(g.clone()))),
            Outcome::Redirect { goto: Goto::Dynamic(e), .. } => {
                let v = e.eval(scope).await?;
                if !v.is_undefined() {
                    return Ok(Some(NextResult::Redirect(v.to_js_string())));
                }
            }
            Outcome::Error { status, message, .. } => {
                let message = match message {
                    Message::Static(m) => m.clone(),
                    Message::Dynamic(e) => {
                        let v = e.eval(scope).await?;
                        if v.is_undefined() { String::new() } else { v.to_js_string() }
                    }
                };
                return Ok(Some(NextResult::Error { status: *status, message }));
            }
        }
    }
    Ok(None)
}

pub fn not_found(message: &str) -> ForgeError {
    ForgeError::evaluation(message)
}
