//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/packages/govuk-components/summary-list/blocks.ts`.

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
    component(&govuk::SUMMARY_LIST, obj! {
        "rows": arr![
            obj! { "key": obj! { "text": "Name" }, "value": obj! { "text": "Sarah Philips" } },
            obj! {
                "key": obj! { "text": "Date of birth" },
                "value": obj! { "text": "5 January 1978" },
            },
            obj! {
                "key": obj! { "text": "Address" },
                "value": obj! { "html": "72 Guild Street<br>London<br>SE23 6FH" },
            },
            obj! {
                "key": obj! { "text": "Contact details" },
                "value": obj! { "text": "07700 900457" },
            },
        ],
    })
}

fn actions_example() -> D {
    component(&govuk::SUMMARY_LIST, obj! {
        "rows": arr![
            obj! {
                "key": obj! { "text": "Name" },
                "value": obj! { "text": "Sarah Philips" },
                "actions": obj! {
                    "items": arr![obj! { "href": "#", "text": "Change", "visuallyHiddenText": "name" }],
                },
            },
            obj! {
                "key": obj! { "text": "Date of birth" },
                "value": obj! { "text": "5 January 1978" },
                "actions": obj! {
                    "items": arr![obj! { "href": "#", "text": "Change", "visuallyHiddenText": "date of birth" }],
                },
            },
            obj! {
                "key": obj! { "text": "Contact details" },
                "value": obj! { "text": "07700 900457" },
                "actions": obj! {
                    "items": arr![obj! { "href": "#", "text": "Change", "visuallyHiddenText": "contact details" }],
                },
            },
        ],
    })
}

fn card_example() -> D {
    component(&govuk::SUMMARY_LIST, obj! {
        "card": obj! {
            "title": obj! { "text": "Personal details" },
            "actions": obj! {
                "items": arr![obj! { "href": "#", "text": "Delete", "classes": "govuk-link--destructive" }],
            },
        },
        "rows": arr![
            obj! { "key": obj! { "text": "Name" }, "value": obj! { "text": "Sarah Philips" } },
            obj! {
                "key": obj! { "text": "Email" },
                "value": obj! { "text": "sarah.philips@example.com" },
            },
            obj! { "key": obj! { "text": "Role" }, "value": obj! { "text": "Senior caseworker" } },
        ],
    })
}

pub fn content() -> D {
    govuk_markdown_block(obj! {
        "content": data("content"),
        "slots": obj! {
            "toc": arr![table_of_contents(obj! { "headings": data("headings") })],
            "basic-example": arr![live_display(arr![basic_example()])],
            "actions-example": arr![live_display(arr![actions_example()])],
            "card-example": arr![live_display(arr![card_example()])],
        },
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        let _ = basic_example();
        let _ = actions_example();
        let _ = card_example();
        let _ = content();
    });
}
