//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/packages/govuk-components/accordion/blocks.ts`.

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
    component(&govuk::ACCORDION, obj! {
        "id": "example-accordion-basic",
        "items": arr![
            obj! {
                "heading": obj! { "text": "Writing well for the web" },
                "content": obj! {
                    "text": "This is the content for Writing well for the web. People do not usually read content unless they want information. Use the inverted pyramid structure and front-load content.",
                },
            },
            obj! {
                "heading": obj! { "text": "Writing well for specialists" },
                "content": obj! {
                    "text": "This is the content for Writing well for specialists. If you are writing for a specialist audience, you can use technical terms they will understand.",
                },
            },
            obj! {
                "heading": obj! { "text": "Know your audience" },
                "content": obj! {
                    "text": "This is the content for Know your audience. Your writing will be most effective if you understand who you are writing for.",
                },
            },
        ],
    })
}

fn summary_example() -> D {
    component(&govuk::ACCORDION, obj! {
        "id": "example-accordion-summary",
        "items": arr![
            obj! {
                "heading": obj! { "text": "Understanding agile" },
                "summary": obj! { "text": "Principles, values, and best practices" },
                "content": obj! {
                    "text": "Agile is an iterative approach to project management and software development. Teams deliver work in small, consumable increments.",
                },
            },
            obj! {
                "heading": obj! { "text": "Working in sprints" },
                "summary": obj! { "text": "Planning, standups, and retrospectives" },
                "content": obj! {
                    "text": "Sprints are short, time-boxed periods when a team works to complete a set amount of work. Sprints are usually one to four weeks long.",
                },
            },
            obj! {
                "heading": obj! { "text": "User research" },
                "summary": obj! { "text": "Understanding user needs through research" },
                "content": obj! {
                    "text": "User research helps teams understand what users need. Use a mix of qualitative and quantitative methods to build evidence.",
                },
            },
        ],
    })
}

pub fn content() -> D {
    govuk_markdown_block(obj! {
        "content": data("content"),
        "slots": obj! {
            "toc": arr![table_of_contents(obj! { "headings": data("headings") })],
            "basic-example": arr![live_display(arr![basic_example()])],
            "summary-example": arr![live_display(arr![summary_example()])],
        },
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        let _ = basic_example();
        let _ = summary_example();
        let _ = content();
    });
}
