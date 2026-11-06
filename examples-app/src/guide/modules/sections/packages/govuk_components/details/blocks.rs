//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/packages/govuk-components/details/blocks.ts`.

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

fn basic_example() -> D {
    component(&govuk::DETAILS, obj! {
        "summaryText": "Help with nationality",
        "text": "If you are not sure about your nationality, try to find out from an official document such as a passport or national ID card.",
    })
}

fn html_example() -> D {
    component(&govuk::DETAILS, obj! {
        "summaryText": "Where to find your reference number",
        "html": "Your reference number is on the letter we sent you. It starts with <strong>HDJ</strong> followed by 4 numbers and a letter, for example <strong>HDJ2123F</strong>.",
    })
}

pub fn content() -> D {
    govuk_markdown_block(obj! {
        "content": data("content"),
        "slots": obj! {
            "toc": arr![table_of_contents(obj! { "headings": data("headings") })],
            "basic-example": arr![live_display(arr![basic_example()])],
            "html-example": arr![live_display(arr![html_example()])],
        },
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        let _ = basic_example();
        let _ = html_example();
        let _ = content();
    });
}
