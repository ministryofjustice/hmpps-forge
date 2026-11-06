//! Async render entry points.

use crate::ast::Node;
use crate::environment::Environment;
use crate::errors::Result;
use crate::renderer::{extract_layout_if_any, CtxStack, RenderState};
use serde_json::{Map, Value};

use super::macros::render_extends_async;
use super::nodes::render_node_async;

/// Main async entry point: parses context, creates state, renders.
pub async fn render_async(env: &Environment, root: &Node, context: Value) -> Result<String> {
    let ctx_map = match context {
        Value::Object(m) => m,
        _ => Map::new(),
    };
    let mut stack = CtxStack::from_root(ctx_map);
    let loader_ref = env.loader.as_ref().map(|l| l.as_ref());
    let mut state = RenderState::new(loader_ref, env.random_seed);
    render_entry_async(env, &mut state, root, &mut stack).await
}

/// Entry: handle `{% extends %}` child templates, otherwise normal render.
pub async fn render_entry_async(
    env: &Environment,
    state: &mut RenderState<'_>,
    root: &Node,
    ctx_stack: &mut CtxStack,
) -> Result<String> {
    if let Some((parent_expr, blocks, prelude)) = extract_layout_if_any(root)? {
        for n in &prelude {
            render_node_async(env, state, n, ctx_stack).await?;
        }
        let parent_name = crate::value::value_to_string(
            &super::eval::eval_to_value_async(env, state, &parent_expr, ctx_stack).await?,
        );
        render_extends_async(env, state, &parent_name, blocks, ctx_stack).await
    } else {
        render_node_async(env, state, root, ctx_stack).await
    }
}
