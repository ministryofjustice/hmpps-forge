//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/packages/moj-components/ticket-panel/blocks.ts`.

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

fn summary_html() -> D {
    D::from("<h2 class=\"govuk-heading-m\">Application submitted</h2><p>Reference: ABC123</p>")
}

fn basic_example() -> D {
    component(&moj::TICKET_PANEL, obj! {
        "items": arr![obj! { "html": summary_html(), "classes": "moj-ticket-panel__content--green" }],
    })
}

fn sections_example() -> D {
    component(&moj::TICKET_PANEL, obj! {
        "attributes": obj! { "aria-label": "Application summary" },
        "items": arr![
            obj! { "html": summary_html(), "classes": "moj-ticket-panel__content--green" },
            obj! { "text": "We will email you within 24 hours to confirm your application." },
        ],
    })
}

pub fn content() -> D {
    govuk_markdown_block(obj! {
        "content": data("content"),
        "slots": obj! {
            "toc": arr![table_of_contents(obj! { "headings": data("headings") })],
            "basic-example": arr![live_display(arr![basic_example()])],
            "sections-example": arr![live_display(arr![sections_example()])],
        },
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        let _ = summary_html();
        let _ = basic_example();
        let _ = sections_example();
        let _ = content();
    });
}
