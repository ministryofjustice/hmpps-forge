//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/packages/govuk-components/select-input/blocks.ts`.

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
    D::V(obj! { "basic": "example-select-basic", "relationship": "example-select-relationship" })
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
    component(&govuk::SELECT_INPUT, obj! {
        "code": "exampleSelectBasic",
        "label": "Country",
        "items": arr![
            obj! { "value": "", "text": "Choose a country" },
            obj! { "value": "uk", "text": "United Kingdom" },
            obj! { "value": "fr", "text": "France" },
            obj! { "value": "de", "text": "Germany" },
            obj! { "value": "es", "text": "Spain" },
        ],
        "validWhen": arr![validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Select a country",
            "groups": arr![example_groups().get("basic")],
        })],
    })
}

fn relationship_example() -> D {
    component(&govuk::SELECT_INPUT, obj! {
        "code": "exampleSelectRelationship",
        "label": obj! {
            "text": "Relationship",
            "classes": D::from(forge_govuk_components::utility_classes()).get("Label").get("Medium"),
        },
        "items": arr![
            obj! { "value": "", "text": "Choose a relationship" },
            obj! { "value": "partner", "text": "Partner or spouse" },
            obj! { "value": "parent", "text": "Parent" },
            obj! { "value": "child", "text": "Son or daughter" },
            obj! { "value": "sibling", "text": "Brother or sister" },
            obj! { "value": "friend", "text": "Friend" },
            obj! { "value": "other", "text": "Other" },
        ],
        "validWhen": arr![validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Select your relationship",
            "groups": arr![example_groups().get("relationship")],
        })],
    })
}

pub fn content() -> D {
    govuk_markdown_block(obj! {
        "content": data("content"),
        "slots": obj! {
            "toc": arr![table_of_contents(obj! { "headings": data("headings") })],
            "basic-example": arr![live_example(example_groups().get("basic"), arr![basic_example()])],
            "relationship-example": arr![live_example(example_groups().get("relationship"), arr![relationship_example()])],
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
        let _ = relationship_example();
        let _ = content();
    });
}
