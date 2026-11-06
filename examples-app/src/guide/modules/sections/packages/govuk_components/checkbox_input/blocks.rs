//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/packages/govuk-components/checkbox-input/blocks.ts`.

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
        "basic": "example-checkbox-basic",
        "exclusive": "example-checkbox-exclusive",
        "reveal": "example-checkbox-reveal",
        "singleQuestion": "example-checkbox-single-question",
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
    component(&govuk::CHECKBOX_INPUT, obj! {
        "code": "exampleCheckboxBasic",
        "fieldset": obj! { "legend": obj! { "text": "How would you like to be contacted?" } },
        "hint": "Select all that apply.",
        "items": arr![
            obj! { "value": "email", "text": "Email" },
            obj! { "value": "phone", "text": "Phone" },
            obj! { "value": "post", "text": "Post" },
        ],
        "validWhen": arr![validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Select how you would like to be contacted",
            "groups": arr![example_groups().get("basic")],
        })],
    })
}

fn exclusive_example() -> D {
    component(&govuk::CHECKBOX_INPUT, obj! {
        "code": "exampleCheckboxExclusive",
        "fieldset": obj! { "legend": obj! { "text": "Which types of waste do you transport?" } },
        "hint": "Select all that apply.",
        "items": arr![
            obj! { "value": "animal", "text": "Waste from animal carcasses" },
            obj! { "value": "mines", "text": "Waste from mines or quarries" },
            obj! { "value": "farm", "text": "Farm or agricultural waste" },
            obj! { "divider": "or" },
            obj! { "value": "none", "text": "I do not transport waste", "behaviour": "exclusive" },
        ],
        "validWhen": arr![validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Select which types of waste you transport, or select that you do not transport waste",
            "groups": arr![example_groups().get("exclusive")],
        })],
    })
}

fn reveal_example() -> D {
    component(&govuk::CHECKBOX_INPUT, obj! {
        "code": "exampleCheckboxReveal",
        "fieldset": obj! { "legend": obj! { "text": "How should we notify you?" } },
        "items": arr![
            obj! {
                "value": "email",
                "text": "Email",
                "block": component(&govuk::TEXT_INPUT, obj! {
                    "code": "exampleRevealEmail",
                    "label": "Email address",
                    "inputType": "email",
                    "dependentWhen": answer("exampleCheckboxReveal").matches(condition::array::contains("email")),
                    "validWhen": arr![validation(obj! {
                        "condition": self_().matches(condition::is_required()),
                        "message": "Enter an email address",
                        "groups": arr![example_groups().get("reveal")],
                    })],
                }),
            },
            obj! {
                "value": "sms",
                "text": "Text message",
                "block": component(&govuk::TEXT_INPUT, obj! {
                    "code": "exampleRevealPhone",
                    "label": "Phone number",
                    "inputType": "tel",
                    "dependentWhen": answer("exampleCheckboxReveal").matches(condition::array::contains("sms")),
                    "validWhen": arr![validation(obj! {
                        "condition": self_().matches(condition::is_required()),
                        "message": "Enter a phone number",
                        "groups": arr![example_groups().get("reveal")],
                    })],
                }),
            },
        ],
        "validWhen": arr![validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Select how you would like to be notified",
            "groups": arr![example_groups().get("reveal")],
        })],
    })
}

fn single_question_example() -> D {
    component(&govuk::CHECKBOX_INPUT, obj! {
        "code": "exampleCheckboxSingleQuestion",
        "fieldset": obj! {
            "legend": obj! {
                "text": "Which countries have you visited?",
                "classes": D::from(forge_govuk_components::utility_classes())
                    .get("Fieldset")
                    .get("LargeLabel"),
                "isPageHeading": false,
            },
        },
        "hint": "Select all that apply.",
        "items": arr![
            obj! { "value": "uk", "text": "United Kingdom" },
            obj! { "value": "france", "text": "France" },
            obj! { "value": "germany", "text": "Germany" },
            obj! { "value": "spain", "text": "Spain" },
            obj! { "divider": "or" },
            obj! {
                "value": "none",
                "text": "I have not visited any of these",
                "behaviour": "exclusive",
            },
        ],
        "validWhen": arr![validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Select which countries you have visited, or select that you have not visited any",
            "groups": arr![example_groups().get("singleQuestion")],
        })],
    })
}

pub fn content() -> D {
    govuk_markdown_block(obj! {
        "content": data("content"),
        "slots": obj! {
            "toc": arr![table_of_contents(obj! { "headings": data("headings") })],
            "basic-example": arr![live_example(example_groups().get("basic"), arr![basic_example()])],
            "exclusive-example": arr![live_example(example_groups().get("exclusive"), arr![exclusive_example()])],
            "reveal-example": arr![live_example(example_groups().get("reveal"), arr![reveal_example()])],
            "single-question-example": arr![live_example(example_groups().get("singleQuestion"), arr![single_question_example()])],
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
        let _ = exclusive_example();
        let _ = reveal_example();
        let _ = single_question_example();
        let _ = content();
    });
}
