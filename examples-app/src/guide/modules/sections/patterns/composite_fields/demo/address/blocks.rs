//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/composite-fields/demo/address/blocks.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;


pub fn heading() -> D {
    component(&govuk::HEADING, obj! { "text": "What is your address?" })
}

pub fn address_line1_field() -> D {
    component(&govuk::TEXT_INPUT, obj! {
        "code": "addressLine1",
        "label": obj! {
            "text": "Address line 1",
            "classes": D::from(forge_govuk_components::utility_classes()).get("Label").get("Medium"),
        },
        "classes": D::from(forge_govuk_components::utility_classes()).get("Input").get("Width30"),
        "autocomplete": "address-line1",
        "formatters": arr![transformer::string::trim()],
        "validWhen": arr![validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Enter the first line of your address",
        })],
    })
}

pub fn address_line2_field() -> D {
    component(&govuk::TEXT_INPUT, obj! {
        "code": "addressLine2",
        "label": obj! {
            "text": "Address line 2 (optional)",
            "classes": D::from(forge_govuk_components::utility_classes()).get("Label").get("Medium"),
        },
        "classes": D::from(forge_govuk_components::utility_classes()).get("Input").get("Width30"),
        "autocomplete": "address-line2",
        "formatters": arr![transformer::string::trim()],
    })
}

pub fn address_town_field() -> D {
    component(&govuk::TEXT_INPUT, obj! {
        "code": "addressTown",
        "label": obj! {
            "text": "Town or city",
            "classes": D::from(forge_govuk_components::utility_classes()).get("Label").get("Medium"),
        },
        "classes": D::from(forge_govuk_components::utility_classes()).get("Input").get("Width20"),
        "autocomplete": "address-level2",
        "formatters": arr![transformer::string::trim()],
        "validWhen": arr![validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Enter your town or city",
        })],
    })
}

pub fn address_postcode_field() -> D {
    component(&govuk::TEXT_INPUT, obj! {
        "code": "addressPostcode",
        "label": obj! {
            "text": "Postcode",
            "classes": D::from(forge_govuk_components::utility_classes()).get("Label").get("Medium"),
        },
        "classes": D::from(forge_govuk_components::utility_classes()).get("Input").get("Width10"),
        "autocomplete": "postal-code",
        "formatters": arr![transformer::string::trim(), transformer::string::to_upper_case()],
        "validWhen": arr![
            validation(obj! {
                "condition": self_().matches(condition::is_required()),
                "message": "Enter your postcode",
            }),
            validation(obj! {
                "condition": self_().matches(condition::address::is_valid_postcode()),
                "message": "Enter a real postcode",
            }),
        ],
    })
}

pub fn continue_button() -> D {
    component(&govuk::BUTTON, obj! { "text": "Continue" })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        let _ = heading();
        let _ = address_line1_field();
        let _ = address_line2_field();
        let _ = address_town_field();
        let _ = address_postcode_field();
        let _ = continue_button();
    });
}
