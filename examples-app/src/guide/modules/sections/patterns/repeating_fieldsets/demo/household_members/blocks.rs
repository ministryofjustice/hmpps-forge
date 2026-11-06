//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/repeating-fieldsets/demo/household-members/blocks.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;


pub fn heading() -> D {
    component(&govuk::HEADING, obj! { "text": "Household members", "size": "l" })
}

pub fn member_rows() -> D {
    component(&core_blocks::COLLECTION_BLOCK, obj! {
        "collection": data("members").each(iterator::map(arr![
            component(&govuk::TEXT_INPUT, obj! {
                "code": format("memberName_%1", vec![Loop.index0()]),
                "label": obj! { "text": "Name" },
                "defaultValue": item().path("memberName"),
                "classes": D::from(forge_govuk_components::utility_classes())
                    .get("Input")
                    .get("Width20"),
                "formatters": arr![transformer::string::trim()],
                "validWhen": arr![validation(obj! {
                    "condition": self_().matches(condition::is_required()),
                    "message": "Enter a name",
                })],
            }),
            component(&govuk::TEXT_INPUT, obj! {
                "code": format("memberAge_%1", vec![Loop.index0()]),
                "label": obj! { "text": "Age" },
                "formatters": arr![transformer::string::to_int()],
                "defaultValue": item().path("memberAge"),
                "classes": D::from(forge_govuk_components::utility_classes())
                    .get("Input")
                    .get("Width5"),
                "inputMode": "numeric",
                "validWhen": arr![
                    validation(obj! {
                        "condition": self_().matches(condition::is_required()),
                        "message": "Enter an age",
                    }),
                    validation(obj! {
                        "condition": self_().matches(condition::number::is_number()),
                        "message": "Enter a number",
                    }),
                ],
            }),
            component(&govuk::BUTTON, obj! {
                "text": "Remove",
                "name": "action",
                "value": format("remove_%1", vec![Loop.index0()]),
                "classes": "govuk-button--warning",
            }),
            component(&govuk::SECTION_BREAK, obj! { "size": "l", "visible": true }),
        ])),
        "fallback": arr![component(&govuk::INSET_TEXT, obj! { "text": "You have not added any household members yet." })],
    })
}

pub fn button_group() -> D {
    component(&govuk::BUTTON_GROUP, obj! {
        "buttons": arr![
            component(&govuk::BUTTON, obj! {
                "text": "Add another person",
                "name": "action",
                "value": "add-another",
                "classes": "govuk-button--secondary",
            }),
            component(&govuk::BUTTON, obj! { "text": "Continue", "name": "action", "value": "continue" }),
        ],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        let _ = heading();
        let _ = member_rows();
        let _ = button_group();
    });
}
