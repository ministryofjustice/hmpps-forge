//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/packages/govuk-components/date-input/blocks.ts`.

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
        "basic": "example-date-basic",
        "validation": "example-date-validation",
        "startDate": "example-date-start",
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

#[allow(unused_variables)]
fn with_groups(validations: D, groups: D) -> D {
    validations.clone().map(|v| spread(vec![v.clone(), D::V(obj! { "groups": groups.clone() })]))
}

fn basic_example() -> D {
    component(&govuk::DATE_INPUT_FULL, obj! {
        "code": "exampleDateBasic",
        "fieldset": obj! { "legend": obj! { "text": "Date of birth" } },
        "hint": "For example, 27 3 1990",
        "validWhen": with_groups(
            D::from(forge_govuk_components::validations::date_input_full(obj! {
                "empty": "Enter a date of birth",
                "missingDay": "Date of birth must include a day",
                "missingMonth": "Date of birth must include a month",
                "missingYear": "Date of birth must include a year",
                "invalid": "Date of birth must be a real date",
            }.into_value())),
            arr![example_groups().get("basic")],
        ),
    })
}

fn validation_example() -> D {
    component(&govuk::DATE_INPUT_FULL, obj! {
        "code": "exampleDateValidation",
        "fieldset": obj! {
            "legend": obj! {
                "text": "What is your date of birth?",
                "classes": D::from(forge_govuk_components::utility_classes())
                    .get("Fieldset")
                    .get("LargeLabel"),
                "isPageHeading": false,
            },
        },
        "hint": "For example, 27 3 1990",
        "validWhen": with_groups(
            D::from(forge_govuk_components::validations::date_input_full(obj! {
                "empty": "Enter your date of birth",
                "missingDay": "Date of birth must include a day",
                "missingMonth": "Date of birth must include a month",
                "missingYear": "Date of birth must include a year",
                "invalid": "Date of birth must be a real date",
                "mustBePast": obj! {
                    "message": "Date of birth must be in the past",
                    "submissionOnly": true,
                },
            }.into_value())),
            arr![example_groups().get("validation")],
        ),
    })
}

fn start_date_example() -> D {
    component(&govuk::DATE_INPUT_FULL, obj! {
        "code": "exampleDateStart",
        "fieldset": obj! { "legend": obj! { "text": "When do you want to start?" } },
        "hint": "For example, 27 3 2025",
        "validWhen": with_groups(
            D::from(forge_govuk_components::validations::date_input_full(obj! {
                "empty": "Enter a start date",
                "missingDay": "Start date must include a day",
                "missingMonth": "Start date must include a month",
                "missingYear": "Start date must include a year",
                "invalid": "Start date must be a real date",
                "mustBeFuture": obj! {
                    "message": "Start date must be in the future",
                    "submissionOnly": true,
                },
            }.into_value())),
            arr![example_groups().get("startDate")],
        ),
    })
}

pub fn content() -> D {
    govuk_markdown_block(obj! {
        "content": data("content"),
        "slots": obj! {
            "toc": arr![table_of_contents(obj! { "headings": data("headings") })],
            "basic-example": arr![live_example(example_groups().get("basic"), arr![basic_example()])],
            "validation-example": arr![live_example(example_groups().get("validation"), arr![validation_example()])],
            "start-date-example": arr![live_example(example_groups().get("startDate"), arr![start_date_example()])],
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
        let _ = validation_example();
        let _ = start_date_example();
        let _ = content();
    });
}
