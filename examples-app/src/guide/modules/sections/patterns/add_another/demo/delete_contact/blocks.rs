//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/add-another/demo/delete-contact/blocks.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;


#[allow(unused_variables)]
fn relationship_label(relationship: D) -> D {
    match_(relationship.clone())
        .branch(condition::equals("partner"), "Partner")
        .branch(condition::equals("parent"), "Parent")
        .branch(condition::equals("sibling"), "Sibling")
        .branch(condition::equals("child"), "Child")
        .branch(condition::equals("friend"), "Friend")
        .branch(condition::equals("colleague"), "Colleague")
        .branch(condition::equals("other"), "Other")
        .otherwise("")
}

pub fn heading() -> D {
    component(&govuk::HEADING, obj! { "text": "Are you sure you want to remove this contact?", "size": "l" })
}

pub fn contact_summary() -> D {
    component(&govuk::SUMMARY_LIST, obj! {
        "rows": arr![
            obj! { "key": obj! { "text": "Name" }, "value": obj! { "text": data("contactName") } },
            obj! {
                "key": obj! { "text": "Relationship" },
                "value": obj! { "text": relationship_label(data("contactRelationship")) },
            },
            obj! {
                "key": obj! { "text": "Phone number" },
                "value": obj! { "text": data("contactPhone") },
            },
        ],
    })
}

pub fn buttons() -> D {
    component(&govuk::BUTTON_GROUP, obj! {
        "buttons": arr![
            component(&govuk::BUTTON, obj! {
                "text": "Remove contact",
                "classes": "govuk-button--warning",
                "name": "action",
                "value": "confirm",
            }),
            component(&govuk::BUTTON, obj! {
                "text": "Cancel",
                "classes": "govuk-button--secondary",
                "name": "action",
                "value": "cancel",
            }),
        ],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        let _ = heading();
        let _ = contact_summary();
        let _ = buttons();
    });
}
