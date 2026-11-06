//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/pre-fill/demo/check-answers/blocks.ts`.

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

pub fn summary_list() -> D {
    component(&govuk::SUMMARY_LIST, obj! {
        "rows": arr![
            obj! {
                "key": obj! { "text": "Address line 1" },
                "value": obj! { "text": answer("addressLine1") },
                "actions": obj! {
                    "items": arr![obj! {
                        "href": "find-address",
                        "text": "Change",
                        "visuallyHiddenText": "address line 1",
                    }],
                },
            },
            obj! {
                "key": obj! { "text": "Address line 2" },
                "value": obj! { "text": answer("addressLine2") },
                "actions": obj! {
                    "items": arr![obj! {
                        "href": "find-address",
                        "text": "Change",
                        "visuallyHiddenText": "address line 2",
                    }],
                },
            },
            obj! {
                "key": obj! { "text": "Town or city" },
                "value": obj! { "text": answer("addressTown") },
                "actions": obj! {
                    "items": arr![obj! {
                        "href": "find-address",
                        "text": "Change",
                        "visuallyHiddenText": "town or city",
                    }],
                },
            },
            obj! {
                "key": obj! { "text": "County" },
                "value": obj! { "text": answer("addressCounty") },
                "actions": obj! {
                    "items": arr![obj! {
                        "href": "find-address",
                        "text": "Change",
                        "visuallyHiddenText": "county",
                    }],
                },
            },
            obj! {
                "key": obj! { "text": "Postcode" },
                "value": obj! { "text": answer("addressPostcode") },
                "actions": obj! {
                    "items": arr![obj! {
                        "href": "find-address",
                        "text": "Change",
                        "visuallyHiddenText": "postcode",
                    }],
                },
            },
        ],
    })
}

pub fn confirm_body() -> D {
    component(&govuk::BODY, obj! { "text": "Selecting \"Confirm\" will save your answers." })
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
        let _ = summary_list();
        let _ = confirm_body();
        let _ = submit_button();
    });
}
