//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/packages/govuk-components/password-input/blocks.ts`.

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
    D::V(obj! { "basic": "example-password-basic", "hint": "example-password-hint" })
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
    component(&govuk::PASSWORD_INPUT, obj! {
        "code": "examplePassword",
        "label": "Password",
        "autocomplete": "current-password",
        "validWhen": arr![validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Enter your password",
            "groups": arr![example_groups().get("basic")],
        })],
    })
}

fn hint_example() -> D {
    component(&govuk::PASSWORD_INPUT, obj! {
        "code": "exampleNewPassword",
        "label": obj! {
            "text": "Create a password",
            "classes": D::from(forge_govuk_components::utility_classes()).get("Label").get("Medium"),
        },
        "hint": "Your password must be at least 8 characters and contain at least one number.",
        "autocomplete": "new-password",
        "validWhen": arr![validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Enter a password",
            "groups": arr![example_groups().get("hint")],
        })],
    })
}

pub fn content() -> D {
    govuk_markdown_block(obj! {
        "content": data("content"),
        "slots": obj! {
            "toc": arr![table_of_contents(obj! { "headings": data("headings") })],
            "basic-example": arr![live_example(example_groups().get("basic"), arr![basic_example()])],
            "hint-example": arr![live_example(example_groups().get("hint"), arr![hint_example()])],
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
        let _ = hint_example();
        let _ = content();
    });
}
