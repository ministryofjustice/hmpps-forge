//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/packages/govuk-components/textarea-input/blocks.ts`.

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

pub fn example_groups() -> D {
    D::V(obj! {
        "basic": "example-textarea-basic",
        "description": "example-textarea-description",
        "notes": "example-textarea-notes",
    })
}

#[allow(unused_variables)]
fn live_example(group: D, blocks: D) -> D {
    component(&core_blocks::TEMPLATE_WRAPPER, obj! {
        "template": "<input type=\"hidden\" name=\"_csrf\" value=\"{{csrfToken}}\">{{slot:content}}{{slot:button}}",
        "tag": "form",
        "classes": "live-example",
        "attributes": obj! { "method": "post", "novalidate": "" },
        "values": obj! { "csrfToken": request::state("csrfToken") },
        "slots": obj! {
            "content": blocks.clone(),
            "button": arr![component(&govuk::BUTTON, obj! { "text": "Submit", "value": group.clone() })],
        },
    })
}

fn basic_example() -> D {
    component(&govuk::TEXTAREA, obj! {
        "code": "exampleTextareaBasic",
        "label": "Give your feedback",
        "formatters": arr![transformer::string::trim()],
        "validWhen": arr![validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Enter your feedback",
            "groups": arr![example_groups().get("basic")],
        })],
    })
}

fn description_example() -> D {
    component(&govuk::TEXTAREA, obj! {
        "code": "exampleTextareaDescription",
        "label": obj! {
            "text": "Describe the incident",
            "classes": D::from(forge_govuk_components::utility_classes()).get("Label").get("Medium"),
        },
        "hint": "Include the date, time, and location.",
        "rows": "8",
        "formatters": arr![transformer::string::trim()],
        "validWhen": arr![
            validation(obj! {
                "condition": self_().matches(condition::is_required()),
                "message": "Enter a description of the incident",
                "groups": arr![example_groups().get("description")],
            }),
            validation(obj! {
                "condition": self_().matches(condition::string::has_max_length(2000.0)),
                "message": "Description must be 2,000 characters or less",
                "groups": arr![example_groups().get("description")],
            }),
        ],
    })
}

fn notes_example() -> D {
    component(&govuk::TEXTAREA, obj! {
        "code": "exampleTextareaNotes",
        "label": "Additional notes",
        "hint": "Enter any extra information, or \"None\".",
        "rows": "3",
        "formatters": arr![transformer::string::trim()],
        "validWhen": arr![validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Enter additional notes or \"None\"",
            "groups": arr![example_groups().get("notes")],
        })],
    })
}

pub fn content() -> D {
    govuk_markdown_block(obj! {
        "content": data("content"),
        "slots": obj! {
            "toc": arr![table_of_contents(obj! { "headings": data("headings") })],
            "basic-example": arr![live_example(example_groups().get("basic"), arr![basic_example()])],
            "description-example": arr![live_example(example_groups().get("description"), arr![description_example()])],
            "notes-example": arr![live_example(example_groups().get("notes"), arr![notes_example()])],
        },
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        let _ = example_groups();
        let _ = basic_example();
        let _ = description_example();
        let _ = notes_example();
        let _ = content();
    });
}
