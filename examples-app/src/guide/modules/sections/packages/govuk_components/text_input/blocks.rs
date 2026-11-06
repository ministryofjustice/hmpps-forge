//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/packages/govuk-components/text-input/blocks.ts`.

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
        "basic": "example-basic",
        "singleQuestion": "example-single-question",
        "postcode": "example-postcode",
        "currency": "example-currency",
        "reference": "example-reference",
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
    component(&govuk::TEXT_INPUT, obj! {
        "code": "exampleBasic",
        "label": "Full name",
        "validWhen": arr![validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Enter your full name",
            "groups": arr![example_groups().get("basic")],
        })],
    })
}

fn single_question_example() -> D {
    component(&govuk::TEXT_INPUT, obj! {
        "code": "exampleSingleQuestion",
        "label": obj! {
            "text": "What is your full name?",
            "classes": D::from(forge_govuk_components::utility_classes()).get("Label").get("Large"),
            "isPageHeading": false,
        },
        "autocomplete": "name",
        "classes": D::from(forge_govuk_components::utility_classes()).get("Input").get("Width20"),
        "formatters": arr![transformer::string::trim()],
        "validWhen": arr![validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Enter your full name",
            "groups": arr![example_groups().get("singleQuestion")],
        })],
    })
}

fn postcode_example() -> D {
    component(&govuk::TEXT_INPUT, obj! {
        "code": "examplePostcode",
        "label": "Postcode",
        "hint": "For example, SW1A 1AA",
        "autocomplete": "postal-code",
        "classes": D::from(forge_govuk_components::utility_classes()).get("Input").get("Width10"),
        "formatters": arr![transformer::string::trim()],
        "validWhen": arr![validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Enter a postcode",
            "groups": arr![example_groups().get("postcode")],
        })],
    })
}

fn currency_example() -> D {
    component(&govuk::TEXT_INPUT, obj! {
        "code": "exampleCurrency",
        "label": "Annual income before tax",
        "hint": "Round to the nearest pound",
        "prefix": obj! { "text": "£" },
        "inputMode": "numeric",
        "classes": D::from(forge_govuk_components::utility_classes()).get("Input").get("Width10"),
        "validWhen": arr![validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Enter your annual income",
            "groups": arr![example_groups().get("currency")],
        })],
    })
}

fn reference_example() -> D {
    component(&govuk::TEXT_INPUT, obj! {
        "code": "exampleReference",
        "label": "Case reference number",
        "hint": "This is on the letter we sent you. For example, HDJ2123F.",
        "classes": template(vec![
            D::from(""),
            D::from(forge_govuk_components::utility_classes()).get("Input").get("Width10"),
            D::from(" "),
            D::from(forge_govuk_components::utility_classes())
                .get("Input")
                .get("ExtraLetterSpacing"),
            D::from(""),
        ]),
        "spellcheck": false,
        "formatters": arr![transformer::string::trim()],
        "validWhen": arr![validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Enter a case reference number",
            "groups": arr![example_groups().get("reference")],
        })],
    })
}

pub fn content() -> D {
    govuk_markdown_block(obj! {
        "content": data("content"),
        "slots": obj! {
            "toc": arr![table_of_contents(obj! { "headings": data("headings") })],
            "basic-example": arr![live_example(example_groups().get("basic"), arr![basic_example()])],
            "single-question-example": arr![live_example(example_groups().get("singleQuestion"), arr![single_question_example()])],
            "postcode-example": arr![live_example(example_groups().get("postcode"), arr![postcode_example()])],
            "currency-example": arr![live_example(example_groups().get("currency"), arr![currency_example()])],
            "reference-example": arr![live_example(example_groups().get("reference"), arr![reference_example()])],
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
        let _ = single_question_example();
        let _ = postcode_example();
        let _ = currency_example();
        let _ = reference_example();
        let _ = content();
    });
}
