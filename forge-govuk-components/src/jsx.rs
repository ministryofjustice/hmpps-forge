//! The GOV.UK components TS writes in JSX (`forge-jsx-components`): heading, body, list, section
//! break, button group and grid row. They build HTML strings directly with no template engine.
//! Escaping and attribute serialisation follow `jsx-runtime.ts`. The `raw()` children follow JS
//! string semantics: a lone child is a template literal (`${undefined}` is `"undefined"`), while
//! children in an array are joined (`undefined`/`null` become `""`).

use forge_core::Value;
use forge_core::engine::errors::{ForgeError, ForgeResult};
use forge_core::engine::registries::ComponentEntry;
use forge_core::value::Map;

const VOID_ELEMENTS: &[&str] = &["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"];

pub fn escape(s: &str) -> String {
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

/// `raw(x)` as a lone child: `${x}`.
fn raw_single(v: &Value) -> String {
    v.to_js_string()
}

/// `raw(x)` inside an array of children: `[..].join('')`.
fn raw_joined(v: &Value) -> String {
    match v {
        Value::Undefined | Value::Null => String::new(),
        v => v.to_js_string(),
    }
}

/// A plain (non-`raw`) child expression such as `{cond && <span/>}`.
fn plain_child(v: &Value) -> String {
    match v {
        Value::Undefined | Value::Null | Value::Bool(_) => String::new(),
        v => escape(&v.to_js_string()),
    }
}

/// `<tag class=... {...attributes}>` (object spread keeps `class` first even when overridden).
fn element(tag: &str, class: String, attributes: &Value, children: Option<String>) -> String {
    let mut props = Map::new();
    props.insert("class".into(), Value::from(class));
    if let Value::Object(attrs) = attributes {
        for (k, v) in attrs.iter() {
            props.insert(k.clone(), v.clone());
        }
    }
    let mut attrs = String::new();
    for (name, value) in props.iter() {
        let name: &str = name;
        if name == "children" {
            continue;
        }
        match value {
            Value::Undefined | Value::Null | Value::Bool(false) => {}
            Value::Bool(true) => attrs += &format!(" {}", escape(name)),
            v => attrs += &format!(" {}=\"{}\"", escape(name), escape(&v.to_js_string())),
        }
    }
    if VOID_ELEMENTS.contains(&tag) {
        format!("<{tag}{attrs}>")
    } else {
        format!("<{tag}{attrs}>{}</{tag}>", children.unwrap_or_default())
    }
}

/// `[a, b && c, d].filter(Boolean).join(' ')`.
fn class_list(parts: impl IntoIterator<Item = Value>) -> String {
    parts.into_iter().filter(Value::truthy).map(|v| v.to_js_string()).collect::<Vec<_>>().join(" ")
}

fn and(cond: Value, then: impl FnOnce() -> Value) -> Value {
    if cond.truthy() { then() } else { cond }
}

fn items(v: &Value, what: &str) -> ForgeResult<Vec<Value>> {
    v.as_array()
        .map(|a| a.to_vec())
        .ok_or_else(|| ForgeError::evaluation(format!("TypeError: Cannot read properties of {} (reading 'map') [{what}]", v.to_js_string())))
}

pub fn heading(p: &Value) -> ForgeResult<String> {
    let size = match p.get("size") {
        Value::Undefined | Value::Null => Value::from("l"),
        s => s,
    };
    let size = size.to_js_string();
    let level = match p.get("level") {
        Value::Undefined | Value::Null => match size.as_str() {
            "xl" | "l" => "1".into(),
            "m" => "2".into(),
            "s" => "3".into(),
            _ => "undefined".into(),
        },
        l => l.to_js_string(),
    };
    let classes = p.get("classes");
    let class = if classes.truthy() {
        format!("govuk-heading-{size} {}", classes.to_js_string())
    } else {
        format!("govuk-heading-{size}")
    };
    let caption = p.get("caption");
    let caption = if caption.truthy() {
        format!("<span class=\"govuk-caption-{size}\">{}</span>", raw_joined(&caption))
    } else {
        plain_child(&caption)
    };
    let children = format!("{caption}{}", raw_joined(&p.get("text")));
    Ok(element(&format!("h{level}"), class, &p.get("attributes"), Some(children)))
}

pub fn body(p: &Value) -> ForgeResult<String> {
    let size = p.get("size");
    let base = if size.truthy() { Value::from(format!("govuk-body-{}", size.to_js_string())) } else { Value::from("govuk-body") };
    let class = class_list([base, p.get("classes")]);
    Ok(element("p", class, &p.get("attributes"), Some(raw_single(&p.get("text")))))
}

pub fn list(p: &Value) -> ForgeResult<String> {
    let style = p.get("style");
    let tag = if style.as_str() == Some("number") { "ol" } else { "ul" };
    let class = class_list([
        Value::from("govuk-list"),
        and(style.clone(), || Value::from(format!("govuk-list--{}", style.to_js_string()))),
        and(p.get("spaced"), || Value::from("govuk-list--spaced")),
        p.get("classes"),
    ]);
    let children: String = items(&p.get("items"), "items")?
        .iter()
        .map(|item| {
            let html = match item {
                Value::Object(_) | Value::Array(_) => item.get("html"),
                other => other.clone(),
            };
            format!("<li>{}</li>", raw_single(&html))
        })
        .collect();
    Ok(element(tag, class, &p.get("attributes"), Some(children)))
}

pub fn section_break(p: &Value) -> ForgeResult<String> {
    let size = p.get("size");
    let class = class_list([
        Value::from("govuk-section-break"),
        and(size.clone(), || Value::from(format!("govuk-section-break--{}", size.to_js_string()))),
        and(p.get("visible"), || Value::from("govuk-section-break--visible")),
        p.get("classes"),
    ]);
    Ok(element("hr", class, &p.get("attributes"), None))
}

fn prefixed_class(base: &str, classes: Value) -> String {
    if classes.truthy() { format!("{base} {}", classes.to_js_string()) } else { base.into() }
}

pub fn button_group(p: &Value) -> ForgeResult<String> {
    let children: String = items(&p.get("buttons"), "buttons")?.iter().map(|b| raw_joined(&b.get("html"))).collect();
    Ok(element("div", prefixed_class("govuk-button-group", p.get("classes")), &p.get("attributes"), Some(children)))
}

pub fn grid_row(p: &Value) -> ForgeResult<String> {
    let mut children = String::new();
    for column in items(&p.get("columns"), "columns")? {
        let inner: String = items(&column.get("blocks"), "blocks")?.iter().map(|b| raw_joined(&b.get("html"))).collect();
        children += &format!("<div class=\"govuk-grid-column-{}\">{inner}</div>", column.get("width").to_js_string());
    }
    Ok(element("div", prefixed_class("govuk-grid-row", p.get("classes")), &p.get("attributes"), Some(children)))
}

pub fn render_for(variant: &str) -> Option<fn(&Value) -> ForgeResult<String>> {
    Some(match variant {
        "govukHeading" => heading,
        "govukBody" => body,
        "govukList" => list,
        "govukSectionBreak" => section_break,
        "govukButtonGroup" => button_group,
        "govukGridRow" => grid_row,
        _ => return None,
    })
}

pub const VARIANTS: &[&str] = &["govukHeading", "govukBody", "govukList", "govukSectionBreak", "govukButtonGroup", "govukGridRow"];

pub fn components() -> Vec<ComponentEntry> {
    VARIANTS
        .iter()
        .map(|v| {
            let render = render_for(v).expect("known variant");
            ComponentEntry::new(v).with_render(move |block, _engine| render(block).map(Value::from))
        })
        .collect()
}
