//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/add-another/demo/add-contact/blocks.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;


pub fn heading() -> D {
    component(&govuk::HEADING, obj! { "text": "Add an emergency contact", "size": "l" })
}

pub fn name_field() -> D {
    component(&govuk::TEXT_INPUT, obj! {
        "code": "contactName",
        "label": obj! {
            "text": "Full name",
            "classes": D::from(forge_govuk_components::utility_classes()).get("Label").get("Medium"),
        },
        "validWhen": arr![validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Enter a full name",
            "submissionOnly": true,
        })],
    })
}

pub fn relationship_field() -> D {
    component(&govuk::SELECT_INPUT, obj! {
        "code": "contactRelationship",
        "label": obj! {
            "text": "Relationship",
            "classes": D::from(forge_govuk_components::utility_classes()).get("Label").get("Medium"),
        },
        "items": arr![
            obj! { "value": "", "text": "Choose a relationship" },
            obj! { "value": "partner", "text": "Partner" },
            obj! { "value": "parent", "text": "Parent" },
            obj! { "value": "sibling", "text": "Sibling" },
            obj! { "value": "child", "text": "Child" },
            obj! { "value": "friend", "text": "Friend" },
            obj! { "value": "colleague", "text": "Colleague" },
            obj! { "value": "other", "text": "Other" },
        ],
        "validWhen": arr![validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Select a relationship",
            "submissionOnly": true,
        })],
    })
}

pub fn phone_field() -> D {
    component(&govuk::TEXT_INPUT, obj! {
        "code": "contactPhone",
        "label": obj! {
            "text": "Phone number",
            "classes": D::from(forge_govuk_components::utility_classes()).get("Label").get("Medium"),
        },
        "validWhen": arr![validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Enter a phone number",
            "submissionOnly": true,
        })],
    })
}

pub fn continue_button() -> D {
    component(&govuk::BUTTON, obj! { "text": "Save and continue" })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        let _ = heading();
        let _ = name_field();
        let _ = relationship_field();
        let _ = phone_field();
        let _ = continue_button();
    });
}
