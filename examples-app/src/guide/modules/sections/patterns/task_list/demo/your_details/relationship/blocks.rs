//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/task-list/demo/your-details/relationship/blocks.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;


pub fn heading() -> D {
    component(&govuk::HEADING, obj! { "text": "What is your relationship to the prisoner?", "size": "l" })
}

pub fn relationship_field() -> D {
    component(&govuk::SELECT_INPUT, obj! {
        "code": "relationship",
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
            obj! { "value": "legal", "text": "Legal representative" },
            obj! { "value": "other", "text": "Other" },
        ],
        "validWhen": arr![validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Select your relationship to the prisoner",
            "submissionOnly": true,
        })],
    })
}

pub fn continue_button() -> D {
    component(&govuk::BUTTON, obj! { "text": "Save and return" })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        let _ = heading();
        let _ = relationship_field();
        let _ = continue_button();
    });
}
