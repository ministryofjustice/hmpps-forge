//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/add-another/demo/check-answers/blocks.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;


pub fn heading() -> D {
    component(&govuk::HEADING, obj! { "text": "Check your answers" })
}

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

pub fn contact_summary_cards() -> D {
    component(&core_blocks::COLLECTION_BLOCK, obj! {
        "collection": answer("contacts").each(iterator::map(component(&govuk::SUMMARY_LIST, obj! {
            "card": obj! { "title": obj! { "text": item().path("contactName") } },
            "rows": arr![
                obj! {
                    "key": obj! { "text": "Relationship" },
                    "value": obj! { "text": relationship_label(item().path("contactRelationship")) },
                },
                obj! {
                    "key": obj! { "text": "Phone number" },
                    "value": obj! { "text": item().path("contactPhone") },
                },
            ],
        }))),
        "fallback": arr![component(&govuk::INSET_TEXT, obj! { "text": "You have not added any emergency contacts." })],
    })
}

pub fn confirm_body() -> D {
    component(&govuk::BODY, obj! { "text": "Selecting \"Confirm\" will save your emergency contacts." })
}

pub fn submit_button() -> D {
    component(&govuk::BUTTON, obj! { "text": "Confirm" })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        let _ = heading();
        let _ = contact_summary_cards();
        let _ = confirm_body();
        let _ = submit_button();
    });
}
