//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/collection-validation/demo/agree-plan/blocks.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;


pub fn heading() -> D {
    component(&govuk::HEADING, obj! { "text": "Agree sentence plan", "size": "l", "caption": "Collection validation demo" })
}

pub fn intro() -> D {
    component(&govuk::BODY, obj! {
        "text": "Review the plan below. You can only agree the plan when every\n  active goal has at least one action assigned to it.",
    })
}

pub fn agree_plan_field() -> D {
    component(&govuk::RADIO_INPUT, obj! {
        "code": "agreePlan",
        "fieldset": obj! {
            "legend": obj! {
                "text": "Do you agree this plan?",
                "classes": D::from(forge_govuk_components::utility_classes())
                    .get("Fieldset")
                    .get("MediumLabel"),
            },
        },
        "items": arr![
            obj! { "value": "yes", "text": "Yes, I agree this plan" },
            obj! { "value": "no", "text": "No, I do not agree this plan" },
        ],
        "validWhen": arr![
            validation(obj! {
                "condition": self_().matches(condition::is_required()),
                "message": "Select whether you agree this plan",
            }),
            validation(obj! {
                "condition": data("goals")
                    .each(iterator::filter(item().path("status").matches(condition::equals("ACTIVE"))))
                    .pipe(vec![D::from(transformer::array::length())])
                    .matches(condition::number::greater_than(0.0)),
                "message": "To agree the plan, create a goal to work on now",
            }),
            data("goals")
                .each(iterator::filter(item().path("status").matches(condition::equals("ACTIVE"))))
                .each(iterator::map(validation(obj! {
                    "condition": item()
                        .path("actions")
                        .pipe(vec![D::from(transformer::array::length())])
                        .matches(condition::number::greater_than(0.0)),
                    "message": format("Add actions to '%1'", vec![item().path("title")]),
                }))),
        ],
    })
}

fn continue_button() -> D {
    component(&govuk::BUTTON, obj! { "text": "Continue" })
}

fn manage_goals_link() -> D {
    component(&govuk::LINK_BUTTON, obj! {
        "text": "Add actions to goals",
        "href": "/forge-developer-guide/patterns/demos/collection-validation/manage-plan",
        "classes": "govuk-button--secondary",
    })
}

pub fn button_group() -> D {
    component(&govuk::BUTTON_GROUP, obj! { "buttons": arr![continue_button(), manage_goals_link()] })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        let _ = heading();
        let _ = intro();
        let _ = agree_plan_field();
        let _ = continue_button();
        let _ = manage_goals_link();
        let _ = button_group();
    });
}
