//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/packages/govuk-components/radio-input/blocks.ts`.

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
        "basic": "example-radio-basic",
        "inline": "example-radio-inline",
        "divider": "example-radio-divider",
        "reveal": "example-radio-reveal",
        "singleQuestion": "example-radio-single-question",
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
    component(&govuk::RADIO_INPUT, obj! {
        "code": "exampleRadioBasic",
        "fieldset": obj! { "legend": obj! { "text": "How would you prefer to be contacted?" } },
        "items": arr![
            obj! { "value": "email", "text": "Email" },
            obj! { "value": "phone", "text": "Phone" },
            obj! { "value": "post", "text": "Post" },
        ],
        "validWhen": arr![validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Select how you would prefer to be contacted",
            "groups": arr![example_groups().get("basic")],
        })],
    })
}

fn inline_example() -> D {
    component(&govuk::RADIO_INPUT, obj! {
        "code": "exampleRadioInline",
        "fieldset": obj! { "legend": obj! { "text": "Do you have a passport?" } },
        "classes": D::from(forge_govuk_components::utility_classes()).get("Radios").get("Inline"),
        "items": arr![obj! { "value": "yes", "text": "Yes" }, obj! { "value": "no", "text": "No" }],
        "validWhen": arr![validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Select yes if you have a passport",
            "groups": arr![example_groups().get("inline")],
        })],
    })
}

fn divider_example() -> D {
    component(&govuk::RADIO_INPUT, obj! {
        "code": "exampleRadioDivider",
        "fieldset": obj! { "legend": obj! { "text": "Where do you live?" } },
        "items": arr![
            obj! { "value": "england", "text": "England" },
            obj! { "value": "scotland", "text": "Scotland" },
            obj! { "value": "wales", "text": "Wales" },
            obj! { "value": "northern-ireland", "text": "Northern Ireland" },
            obj! { "divider": "or" },
            obj! { "value": "abroad", "text": "I live abroad" },
        ],
        "validWhen": arr![validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Select where you live",
            "groups": arr![example_groups().get("divider")],
        })],
    })
}

fn reveal_example() -> D {
    component(&govuk::RADIO_INPUT, obj! {
        "code": "exampleRadioReveal",
        "fieldset": obj! { "legend": obj! { "text": "How did you hear about us?" } },
        "items": arr![
            obj! { "value": "search-engine", "text": "Search engine" },
            obj! {
                "value": "social-media",
                "text": "Social media",
                "block": component(&govuk::TEXT_INPUT, obj! {
                    "code": "exampleRevealPlatform",
                    "label": "Which platform?",
                    "dependentWhen": answer("exampleRadioReveal").matches(condition::equals("social-media")),
                    "classes": D::from(forge_govuk_components::utility_classes())
                        .get("Input")
                        .get("Width20"),
                    "formatters": arr![transformer::string::trim()],
                    "validWhen": arr![validation(obj! {
                        "condition": self_().matches(condition::is_required()),
                        "message": "Enter the platform where you saw us",
                        "groups": arr![example_groups().get("reveal")],
                    })],
                }),
            },
            obj! { "value": "friend", "text": "Friend or colleague" },
            obj! {
                "value": "other",
                "text": "Other",
                "block": component(&govuk::TEXT_INPUT, obj! {
                    "code": "exampleRevealOther",
                    "label": "Please specify",
                    "dependentWhen": answer("exampleRadioReveal").matches(condition::equals("other")),
                    "classes": D::from(forge_govuk_components::utility_classes())
                        .get("Input")
                        .get("Width20"),
                    "formatters": arr![transformer::string::trim()],
                    "validWhen": arr![validation(obj! {
                        "condition": self_().matches(condition::is_required()),
                        "message": "Enter where you heard about us",
                        "groups": arr![example_groups().get("reveal")],
                    })],
                }),
            },
        ],
        "validWhen": arr![validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Select how you heard about us",
            "groups": arr![example_groups().get("reveal")],
        })],
    })
}

fn single_question_example() -> D {
    component(&govuk::RADIO_INPUT, obj! {
        "code": "exampleRadioSingleQuestion",
        "fieldset": obj! {
            "legend": obj! {
                "text": "How would you like to meet?",
                "classes": D::from(forge_govuk_components::utility_classes())
                    .get("Fieldset")
                    .get("LargeLabel"),
                "isPageHeading": false,
            },
        },
        "hint": "Pick the option that works best for you.",
        "items": arr![
            obj! { "value": "in-person", "text": "In person" },
            obj! { "value": "video", "text": "Video call" },
            obj! { "value": "phone", "text": "Phone call" },
        ],
        "validWhen": arr![validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Select how you would like to meet",
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
            "inline-example": arr![live_example(example_groups().get("inline"), arr![inline_example()])],
            "divider-example": arr![live_example(example_groups().get("divider"), arr![divider_example()])],
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
        let _ = inline_example();
        let _ = divider_example();
        let _ = reveal_example();
        let _ = single_question_example();
        let _ = content();
    });
}
