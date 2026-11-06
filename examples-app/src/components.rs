//! The guide's own components (`journeys/forge-developer-guide/components/*`).

use forge_core::Value;
use forge_core::authoring::Component;
use forge_core::engine::registries::ComponentEntry;
use forge_core::schema::Schema;

use crate::markdown::govuk_markdown;

pub const GOVUK_MARKDOWN: Component = Component::basic("govukMarkdown");
pub const TABLE_OF_CONTENTS: Component = Component::basic("tableOfContents");
pub const LOTTERY_BALL: Component = Component::basic("lotteryBall");
pub const RICH_TEXT_EDITOR: Component = Component::field("richTextEditor");

fn markdown_render(block: &Value) -> Value {
    let content = block.get("content");
    if !content.truthy() {
        return Value::from("");
    }
    let content = content.to_js_string();
    let slots = block.get("slots");
    if !matches!(slots, Value::Object(_)) {
        return Value::from(govuk_markdown(&content, None));
    }
    let lookup = |name: &str| match slots.get(name) {
        Value::Array(rendered) => Some(rendered.iter().map(|b| b.get("html").to_js_string()).collect::<String>()),
        _ => None,
    };
    Value::from(govuk_markdown(&content, Some(&lookup)))
}

fn table_of_contents(block: &Value) -> Value {
    let headings = match block.get("headings") {
        Value::Array(h) if !h.is_empty() => h,
        _ => return Value::from(""),
    };
    let items: String = headings
        .iter()
        .map(|h| {
            format!(
                "\n          <li class=\"guide-contents__item\">\n            <a class=\"govuk-link govuk-link--no-visited-state\" href=\"#{}\">{}</a>\n          </li>",
                h.get("slug").to_js_string(),
                h.get("text").to_js_string()
            )
        })
        .collect();
    Value::from(format!(
        "\n      <nav class=\"guide-contents\" aria-label=\"Contents\">\n        <h2 class=\"govuk-body-s govuk-!-margin-bottom-1\">Contents</h2>\n        <ol class=\"govuk-list guide-contents__list\">{items}\n        </ol>\n      </nav>"
    ))
}

fn lottery_ball(block: &Value) -> Value {
    let num = match block.get("number") {
        Value::Undefined | Value::Null => String::new(),
        n => n.to_js_string(),
    };
    let color = match block.get("color") {
        Value::Undefined | Value::Null => "blue".to_string(),
        c => c.to_js_string(),
    };
    let classes = block.get("classes");
    let extra = if classes.truthy() { format!(" {}", classes.to_js_string()) } else { String::new() };
    Value::from(format!(
        "<div class=\"lottery-ball lottery-ball--{color}{extra}\">\n    <span class=\"lottery-ball__number\">{num}</span>\n  </div>"
    ))
}

/// `{ text: value }` for strings, the object as is, `undefined` for falsy values.
fn string_or_object(v: Value) -> Value {
    match v {
        v if !v.truthy() => Value::Undefined,
        v @ (Value::Object(_) | Value::Array(_)) => v,
        v => Value::from_pairs([("text", v)]),
    }
}

fn rich_text_editor_params(block: &Value) -> Value {
    let toolbar = match block.get("toolbar") {
        Value::Undefined | Value::Null => Value::from_pairs(
            ["bold", "italic", "underline", "bullets", "numbers"].map(|k| (k, Value::Bool(true))),
        ),
        t => t,
    };
    let mut attributes = Value::from_pairs([("data-module", Value::from("moj-rich-text-editor"))]);
    if let Value::Object(t) = &toolbar {
        for (key, enabled) in t.iter() {
            if enabled.truthy() {
                attributes.set(format!("data-toolbar.{key}"), Value::from("true"));
            }
        }
    }
    let errors = block.get("errors");
    let error_message = match errors.get("length") {
        n if n.truthy() => Value::from_pairs([("text", errors.get("0").get("message"))]),
        n => n,
    };
    let id = match block.get("id") {
        Value::Undefined | Value::Null => block.get("code"),
        id => id,
    };
    let rows = match block.get("rows") {
        r if r.truthy() => r,
        _ => Value::from("8"),
    };
    Value::from_pairs([
        ("id", id),
        ("name", block.get("code")),
        ("rows", rows),
        ("value", block.get("value")),
        ("label", string_or_object(block.get("label"))),
        ("hint", string_or_object(block.get("hint"))),
        ("errorMessage", error_message),
        ("formGroup", Value::from_pairs([("attributes", attributes)])),
        ("classes", block.get("classes")),
    ])
}

pub fn components() -> Vec<ComponentEntry> {
    vec![
        ComponentEntry::new("govukMarkdown").with_render(|b, _| Ok(markdown_render(b))),
        ComponentEntry::new("tableOfContents").with_render(|b, _| Ok(table_of_contents(b))),
        ComponentEntry::new("lotteryBall").with_render(|b, _| Ok(lottery_ball(b))),
        ComponentEntry::new("richTextEditor")
            .with_input(Schema::String)
            .with_render(forge_runjucks::nunjucks_render("govuk/components/textarea/template.njk", rich_text_editor_params)),
    ]
}
