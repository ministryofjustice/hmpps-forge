//! Core components (port of `built-ins/components`): `html`, `collection-block`,
//! `templateWrapper` and `fragment`, which build HTML strings directly.

use std::sync::LazyLock;

use regex::Regex;

use crate::engine::errors::{ForgeError, ForgeResult};
use crate::authoring::Component;
use crate::engine::registries::ComponentEntry;

/// Block builders for the core components (`HtmlBlock`, `CollectionBlock`, `TemplateWrapper`,
/// `Fragment`).
pub const HTML: Component = Component::basic("html");
pub const COLLECTION_BLOCK: Component = Component::basic("collection-block");
pub const TEMPLATE_WRAPPER: Component = Component::basic("templateWrapper");
pub const FRAGMENT: Component = Component::basic("fragment");
use crate::value::Value;

const VOID_ELEMENTS: &[&str] = &["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"];

/// `escapeHtmlEntities`.
pub fn escape_html_entities(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '&' => out.push_str("&amp;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&#39;"),
            c => out.push(c),
        }
    }
    out
}

/// `isRenderedBlock`: `{ block, html }` as produced for nested blocks.
fn is_rendered_block(v: &Value) -> bool {
    matches!(v.get("html"), Value::String(_)) && matches!(v.get("block"), Value::Object(_))
}

/// Child content as HTML: rendered blocks contribute their HTML, arrays are joined, `undefined`
/// and `null` are empty, anything else is stringified (`(content as string) ?? ''`).
fn content_html(v: &Value) -> String {
    match v {
        Value::Array(items) => items.iter().map(content_html).collect(),
        v if is_rendered_block(v) => v.get("html").to_js_string(),
        Value::Undefined | Value::Null => String::new(),
        v => v.to_js_string(),
    }
}

/// `<tag class=.. attrs..>` for the wrapper-capable components, or `None` without a wrapper.
fn open_tag(props: &Value) -> Option<(String, String)> {
    let (tag, classes, attributes) = (props.get("tag"), props.get("classes"), props.get("attributes"));
    if !tag.truthy() && !classes.truthy() && !attributes.truthy() {
        return None;
    }
    let element = match tag {
        Value::Undefined | Value::Null => "div".to_string(),
        t => t.to_js_string(),
    };
    let mut open = format!("<{element}");
    if classes.truthy() {
        open += &format!(" class=\"{}\"", escape_html_entities(&classes.to_js_string()));
    }
    if let Value::Object(attrs) = &attributes {
        for (k, v) in attrs.iter() {
            open += &format!(" {}=\"{}\"", escape_html_entities(k), escape_html_entities(&v.to_js_string()));
        }
    }
    open.push('>');
    Some((element, open))
}

fn wrap(props: &Value, content: String) -> String {
    match open_tag(props) {
        Some((element, open)) => format!("{open}{content}</{element}>"),
        None => content,
    }
}

pub fn html(props: &Value) -> ForgeResult<String> {
    if !props.get("tag").truthy() && !props.get("classes").truthy() && !props.get("attributes").truthy() {
        return Ok(content_html(&props.get("content")));
    }
    let (element, open) = open_tag(props).expect("wrapper requested");
    if VOID_ELEMENTS.contains(&element.as_str()) {
        return Ok(open);
    }
    Ok(format!("{open}{}</{element}>", content_html(&props.get("content"))))
}

pub fn collection_block(props: &Value) -> ForgeResult<String> {
    let non_empty = |v: Value| v.as_array().filter(|a| !a.is_empty()).map(|a| a.to_vec());
    let content = match (non_empty(props.get("collection")), non_empty(props.get("fallback"))) {
        (Some(items), _) | (None, Some(items)) => items.iter().map(content_html).collect(),
        (None, None) => String::new(),
    };
    Ok(wrap(props, content))
}

static SLOT_MARKER: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\{\{slot:[^}]+}}").unwrap());
static VALUE_MARKER: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\{\{[^}]+}}").unwrap());

pub fn template_wrapper(props: &Value) -> ForgeResult<String> {
    let mut content = props.get("template").to_js_string();
    if let Value::Object(values) = props.get("values") {
        for (key, value) in values.iter() {
            content = content.replace(&format!("{{{{{key}}}}}"), &content_html(value));
        }
    }
    if let Value::Object(slots) = props.get("slots") {
        for (name, rendered) in slots.iter() {
            let html: String = rendered
                .as_array()
                .ok_or_else(|| ForgeError::evaluation(format!("TypeError: renderedBlocks.map is not a function (slot {name})")))?
                .iter()
                .map(|b| match b.get("html") {
                    Value::Undefined | Value::Null => String::new(),
                    h => h.to_js_string(),
                })
                .collect();
            content = content.replace(&format!("{{{{slot:{name}}}}}"), &html);
        }
    }
    let content = SLOT_MARKER.replace_all(&content, "");
    let content = VALUE_MARKER.replace_all(&content, "").into_owned();
    Ok(wrap(props, content))
}

pub fn fragment(props: &Value) -> ForgeResult<String> {
    fn child(v: &Value) -> String {
        match v {
            Value::Array(items) => items.iter().map(child).collect(),
            v if is_rendered_block(v) => v.get("html").to_js_string(),
            _ => String::new(),
        }
    }
    let blocks = props.get("blocks");
    let items = blocks
        .as_array()
        .ok_or_else(|| ForgeError::evaluation("TypeError: Cannot read properties of undefined (reading 'map')"))?;
    Ok(items.iter().map(child).collect())
}

pub fn all() -> Vec<ComponentEntry> {
    let entry = |variant: &str, render: fn(&Value) -> ForgeResult<String>| {
        ComponentEntry::new(variant).with_render(move |block, _| render(block).map(Value::from))
    };
    vec![
        entry("html", html),
        entry("collection-block", collection_block),
        entry("templateWrapper", template_wrapper),
        entry("fragment", fragment),
    ]
}
