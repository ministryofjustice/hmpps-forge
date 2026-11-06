//! Render (port of `concerns/render`): renders resolved blocks through the supplied renderer,
//! nested render blocks first, then assembles the page.

use std::sync::Arc;

use crate::engine::concerns::resolve::RenderBlock;
use crate::engine::errors::{ForgeError, ForgeResult};
use crate::engine::registries::{ComponentEntry, ComponentRegistry};
use crate::engine::tracing::{fields, Span};
use crate::value::{Map, Value};

/// A page renderer (`ForgeRenderer`). Output is opaque to the engine; adapters choose it.
pub trait Renderer: Send + Sync {
    /// The engine component render functions receive (`renderer` in TS).
    fn engine(&self) -> &dyn std::any::Any;

    fn render_block(&self, entry: &ComponentEntry, block: &Value) -> ForgeResult<Value> {
        let render = entry.render.as_ref().ok_or_else(|| {
            ForgeError::evaluation(format!("Component variant \"{}\" has no render function", entry.variant))
        })?;
        render(block, self.engine())
    }

    /// Wraps output for devtools inspection (only while tracing).
    fn mark_block(&self, _node_id: &str, output: Value) -> Value {
        output
    }

    /// What a parent block sees in place of a nested block it contains.
    fn wrap_nested_block(&self, block: &Value, output: Value) -> Value;

    fn assemble_page(&self, context: &Value, rendered_blocks: &[Value], request_state: &Value) -> ForgeResult<Value>;
}

/// `toEvaluatedBlock`: `{ type, variant, blockType, ...properties }`.
fn evaluated_block(block: &RenderBlock, properties: &Value) -> Value {
    let mut map = Map::new();
    map.insert("type".into(), Value::from("StructureType.Block"));
    map.insert("variant".into(), Value::String(block.variant.clone()));
    map.insert("blockType".into(), Value::from(block.block_type));
    if let Value::Object(p) = properties {
        for (k, v) in p.iter() {
            map.insert(k.clone(), v.clone());
        }
    }
    Value::object(map)
}

/// `render.render-blocks.block`, as a unit under `parent`. Output is marked for devtools only
/// while the request is traced.
pub fn render_block(
    block: &RenderBlock,
    renderer: &dyn Renderer,
    components: &ComponentRegistry,
    mark: bool,
    parent: &Span,
) -> ForgeResult<Value> {
    let span = parent.child(block.id.to_string(), "render.render-blocks.block", || {
        fields([
            ("id", Value::String(block.id.clone())),
            ("variant", Value::String(block.variant.clone())),
            ("blockType", Value::from(block.block_type)),
        ])
    });
    if block.properties.get("visibleWhen").strict_eq(&Value::Bool(false)) {
        span.omit();
        return Ok(Value::from(""));
    }
    let entry = components
        .get(&block.variant)
        .ok_or_else(|| ForgeError::UnregisteredComponent { variant: block.variant.to_string() })?;
    let properties = replace_nested(&block.properties, renderer, components, mark, &span)?;
    let output = renderer.render_block(entry, &evaluated_block(block, &properties))?;
    let output = if mark { renderer.mark_block(&block.id, output) } else { output };
    span.done();
    Ok(output)
}

fn replace_nested(
    value: &Value,
    renderer: &dyn Renderer,
    components: &ComponentRegistry,
    mark: bool,
    span: &Span,
) -> ForgeResult<Value> {
    if let Some(nested) = value.downcast::<RenderBlock>() {
        let output = render_block(nested, renderer, components, mark, span)?;
        return Ok(renderer.wrap_nested_block(&evaluated_block(nested, &nested.properties), output));
    }
    Ok(match value {
        Value::Array(items) => Value::array(
            items.iter().map(|i| replace_nested(i, renderer, components, mark, span)).collect::<ForgeResult<_>>()?,
        ),
        Value::Object(o) => {
            let mut map = Map::new();
            for (k, v) in o.iter() {
                map.insert(k.clone(), replace_nested(v, renderer, components, mark, span)?);
            }
            Value::object(map)
        }
        other => other.clone(),
    })
}

/// `request.render`: every top-level block, then the page.
pub fn render_page(
    context: &Value,
    renderer: &Arc<dyn Renderer>,
    components: &ComponentRegistry,
    request_state: &Value,
    phase: &Span,
) -> ForgeResult<Value> {
    let mark = phase.enabled();
    let blocks = context.get("blocks").as_array().map(|a| a.iter().cloned().collect::<Vec<_>>()).unwrap_or_default();
    let span = phase.child("render-blocks", "render.render-blocks", || fields([("blocks", Value::from(blocks.len()))]));
    let mut rendered = Vec::new();
    for block in blocks {
        match block.downcast::<RenderBlock>() {
            Some(b) => rendered.push(render_block(b, renderer.as_ref(), components, mark, &span)?),
            None => rendered.push(Value::from("")),
        }
    }
    span.done();
    let assemble =
        phase.child("assemble-page", "render.assemble-page", || fields([("renderedBlocks", Value::from(rendered.len()))]));
    let page = renderer.assemble_page(context, &rendered, request_state)?;
    assemble.done();
    Ok(page)
}
