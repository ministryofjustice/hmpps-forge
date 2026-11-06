//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/packages/moj-components/filter/blocks.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::support::govuk_markdown_block;
use crate::guide::support::table_of_contents;

#[allow(unused_variables)]
fn live_display(blocks: D) -> D {
    component(&core_blocks::TEMPLATE_WRAPPER, obj! {
        "template": "{{slot:content}}",
        "classes": "live-example",
        "slots": obj! { "content": blocks.clone() },
    })
}

fn options_html() -> D {
    D::from(
        "\n  <div class=\"govuk-form-group\">\n    <label class=\"govuk-label\" for=\"status\">Status</label>\n    <select class=\"govuk-select\" id=\"status\" name=\"status\">\n      <option value=\"\">Any status</option>\n      <option value=\"open\">Open</option>\n      <option value=\"closed\">Closed</option>\n    </select>\n  </div>\n",
    )
}

fn basic_example() -> D {
    component(&moj::FILTER, obj! {
        "heading": obj! { "text": "Filter" },
        "submit": obj! { "text": "Apply filters" },
        "optionsHtml": options_html(),
    })
}

fn selected_example() -> D {
    component(&moj::FILTER, obj! {
        "heading": obj! { "text": "Filter" },
        "selectedFilters": obj! {
            "heading": obj! { "text": "Selected filters" },
            "clearLink": obj! { "href": "#clear", "text": "Clear filters" },
            "categories": arr![obj! {
                "heading": obj! { "text": "Status" },
                "items": arr![obj! { "text": "Open", "href": "#remove-open" }],
            }],
        },
        "submit": obj! { "text": "Apply filters" },
        "optionsHtml": options_html(),
    })
}

pub fn content() -> D {
    govuk_markdown_block(obj! {
        "content": data("content"),
        "slots": obj! {
            "toc": arr![table_of_contents(obj! { "headings": data("headings") })],
            "basic-example": arr![live_display(arr![basic_example()])],
            "selected-example": arr![live_display(arr![selected_example()])],
        },
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        let _ = options_html();
        let _ = basic_example();
        let _ = selected_example();
        let _ = content();
    });
}
