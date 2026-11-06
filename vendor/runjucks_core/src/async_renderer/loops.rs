//! Async loop and switch rendering.

use crate::ast::{Expr, ForVars, Node, SwitchCase};
use crate::environment::Environment;
use crate::errors::Result;
use crate::render_common::{iterable_empty, iterable_from_value, Iterable};
use crate::renderer::{CtxStack, RenderState};
use serde_json::Value;

use super::eval::eval_to_value_async;
use super::nodes::render_children_async;

fn inject_loop(stack: &mut CtxStack, i: usize, len: usize) {
    crate::render_common::inject_loop(&mut stack.frames, i, len);
    stack.bump_revision();
}

pub(super) async fn render_for_async(
    env: &Environment,
    state: &mut RenderState<'_>,
    vars: &ForVars,
    iter_expr: &Expr,
    body: &[Node],
    else_body: Option<&[Node]>,
    stack: &mut CtxStack,
) -> Result<String> {
    let v = eval_to_value_async(env, state, iter_expr, stack).await?;
    let it = iterable_from_value(v);
    if iterable_empty(&it) {
        return if let Some(eb) = else_body {
            render_children_async(env, state, eb, stack).await
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
                stack.set_local(x, item);
                acc.push_str(&render_children_async(env, state, body, stack).await?);
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
                acc.push_str(&render_children_async(env, state, body, stack).await?);
            }
        }
        (ForVars::Multi(names), Iterable::Pairs(pairs)) if names.len() == 2 => {
            let len = pairs.len();
            acc.reserve(len.saturating_mul(16));
            for (i, (k, v)) in pairs.into_iter().enumerate() {
                inject_loop(stack, i, len);
                stack.set_local(&names[0], Value::String(k));
                stack.set_local(&names[1], v);
                acc.push_str(&render_children_async(env, state, body, stack).await?);
            }
        }
        (ForVars::Single(_), _) | (ForVars::Multi(_), _) => {
            stack.pop_frame();
            return if let Some(eb) = else_body {
                render_children_async(env, state, eb, stack).await
            } else {
                Ok(String::new())
            };
        }
    }

    stack.pop_frame();
    Ok(acc)
}

pub(super) async fn render_switch_async(
    env: &Environment,
    state: &mut RenderState<'_>,
    disc_expr: &Expr,
    cases: &[SwitchCase],
    default_body: Option<&[Node]>,
    stack: &mut CtxStack,
) -> Result<String> {
    let disc = eval_to_value_async(env, state, disc_expr, stack).await?;
    let mut start = None;
    for (i, c) in cases.iter().enumerate() {
        if eval_to_value_async(env, state, &c.cond, stack).await? == disc {
            start = Some(i);
            break;
        }
    }
    let mut acc = String::new();
    if let Some(mut idx) = start {
        loop {
            let body = &cases[idx].body;
            acc.push_str(&render_children_async(env, state, body, stack).await?);
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
        acc.push_str(&render_children_async(env, state, db, stack).await?);
    }
    Ok(acc)
}

/// `{% asyncEach %}` — sequential async iteration (same as `for` in async mode).
pub(super) async fn render_async_each(
    env: &Environment,
    state: &mut RenderState<'_>,
    vars: &ForVars,
    iter_expr: &Expr,
    body: &[Node],
    else_body: Option<&[Node]>,
    stack: &mut CtxStack,
) -> Result<String> {
    render_for_async(env, state, vars, iter_expr, body, else_body, stack).await
}

/// `{% asyncAll %}` — in Nunjucks this signals parallel intent, but since we hold `&mut RenderState`
/// we execute sequentially (same observable result for deterministic templates).
pub(super) async fn render_async_all(
    env: &Environment,
    state: &mut RenderState<'_>,
    vars: &ForVars,
    iter_expr: &Expr,
    body: &[Node],
    else_body: Option<&[Node]>,
    stack: &mut CtxStack,
) -> Result<String> {
    render_for_async(env, state, vars, iter_expr, body, else_body, stack).await
}
