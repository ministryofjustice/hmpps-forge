//! Async macro body rendering and `{% extends %}` support.

use crate::ast::{MacroDef, Node};
use crate::environment::Environment;
use crate::errors::{Result, RunjucksError};
use crate::loader::TemplateLoader;
use crate::renderer::{
    collect_blocks_in_root, extends_parent_expr, CallerFrame, CtxStack, RenderState,
};
use serde_json::Value;
use std::collections::{HashMap, HashSet};

use super::eval::eval_to_value_async;
use super::nodes::render_children_async;

pub(super) async fn render_macro_body_async(
    env: &Environment,
    state: &mut RenderState<'_>,
    m: &MacroDef,
    positional: &[Value],
    kwargs: &[(String, Value)],
    outer: &mut CtxStack,
    module_closure: Option<&HashMap<String, Value>>,
) -> Result<String> {
    let mut inner = outer.flatten();
    if let Some(mc) = module_closure {
        for (k, v) in mc {
            inner.insert(k.clone(), v.clone());
        }
    }
    for p in &m.params {
        let val = if let Some(ref d) = p.default {
            eval_to_value_async(env, state, d, outer).await?
        } else {
            Value::Null
        };
        inner.insert(p.name.clone(), val);
    }
    for (i, p) in m.params.iter().enumerate() {
        if let Some(v) = positional.get(i) {
            inner.insert(p.name.clone(), v.clone());
        }
    }
    for (k, v) in kwargs {
        if m.params.iter().any(|p| p.name == *k) {
            inner.insert(k.clone(), v.clone());
        }
    }
    let mut stack = CtxStack::from_root(inner);
    render_children_async(env, state, &m.body, &mut stack).await
}

pub(super) async fn render_caller_invocation_async(
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
        return render_children_async(env, state, &frame.body, stack).await;
    }
    stack.push_frame();
    for p in &frame.params {
        let val = if let Some(ref d) = p.default {
            eval_to_value_async(env, state, d, stack).await?
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
    let out = render_children_async(env, state, &frame.body, stack).await?;
    stack.pop_frame();
    Ok(out)
}

/// Async version of `render_extends` — handles `{% extends "parent.html" %}`.
pub(super) async fn render_extends_async(
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
    let chains = build_block_chains_async(
        parent_name,
        parent_ast.as_ref(),
        &blocks,
        loader,
        &mut visited,
        env,
        state,
        ctx_stack,
    )
    .await?;
    let mut root_ast = parent_ast;
    let mut pushed = 1;
    while let Some((gp_expr, _, prelude)) = crate::renderer::extract_layout_if_any(root_ast.as_ref())? {
        for n in &prelude {
            super::nodes::render_node_async(env, state, n, ctx_stack).await?;
        }
        let gp_name = crate::value::value_to_string(&super::eval::eval_to_value_async(env, state, &gp_expr, ctx_stack).await?);
        root_ast = env.load_and_parse_named(&gp_name, loader)?;
        state.push_template(&gp_name)?;
        pushed += 1;
    }
    let prev_chains = state.block_chains.take();
    state.block_chains = Some(chains);
    let out = super::nodes::render_node_async(env, state, root_ast.as_ref(), ctx_stack).await;
    state.block_chains = prev_chains;
    for _ in 0..pushed {
        state.pop_template();
    }
    out
}

#[allow(clippy::too_many_arguments)]
fn build_block_chains_async<'a>(
    parent_name: &'a str,
    parent_ast: &'a Node,
    immediate_child_overrides: &'a HashMap<String, Vec<Node>>,
    loader: &'a (dyn TemplateLoader + Send + Sync),
    visited: &'a mut HashSet<String>,
    env: &'a Environment,
    state: &'a mut RenderState<'_>,
    ctx_stack: &'a mut CtxStack,
) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<HashMap<String, Vec<Vec<Node>>>>> + 'a>> {
    Box::pin(build_block_chains_inner(parent_name, parent_ast, immediate_child_overrides, loader, visited, env, state, ctx_stack))
}

#[allow(clippy::too_many_arguments)]
async fn build_block_chains_inner(
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

    let result = async {
        let local_blocks = collect_blocks_in_root(parent_ast);
        let inherited: HashMap<String, Vec<Vec<Node>>> =
            if let Some(gp_expr) = extends_parent_expr(parent_ast) {
                let gp_name = crate::value::value_to_string(
                    &eval_to_value_async(env, state, gp_expr, ctx_stack).await?,
                );
                let gp_ast = env.load_and_parse_named(&gp_name, loader)?;
                build_block_chains_async(
                    &gp_name,
                    gp_ast.as_ref(),
                    &local_blocks,
                    loader,
                    visited,
                    env,
                    state,
                    ctx_stack,
                )
                .await?
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
    }
    .await;

    visited.remove(parent_name);
    result
}
