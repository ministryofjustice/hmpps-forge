//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/pre-fill/demo/find-address/blocks.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;


pub fn heading() -> D {
    component(&govuk::HEADING, obj! { "text": "Find an address", "size": "l" })
}

pub fn postcode_field() -> D {
    component(&govuk::TEXT_INPUT, obj! {
        "code": "postcode",
        "label": obj! { "text": "Postcode" },
        "hint": obj! { "text": "Try SW1A 1AA, SW1A 2AA, or LS1 2BJ" },
        "classes": D::from(forge_govuk_components::utility_classes()).get("Input").get("Width10"),
        "formatters": arr![transformer::string::trim()],
        "validWhen": arr![
            validation(obj! {
                "condition": self_().matches(condition::is_required()),
                "message": "Enter a postcode",
                "submissionOnly": true,
                "groups": arr!["find-postcode"],
            }),
            validation(obj! {
                "condition": or(vec![not(self_().matches(condition::is_required())), self_().matches(condition::address::is_valid_postcode())]),
                "message": "Enter a valid postcode",
                "submissionOnly": true,
                "groups": arr!["find-postcode"],
            }),
        ],
    })
}

pub fn find_address_button() -> D {
    component(&govuk::BUTTON, obj! {
        "text": "Find address",
        "name": "action",
        "value": "find-address",
        "classes": "govuk-button--secondary",
    })
}

pub fn address_line1_field() -> D {
    component(&govuk::TEXT_INPUT, obj! {
        "code": "addressLine1",
        "label": obj! { "text": "Address line 1" },
        "autocomplete": "address-line1",
        "validWhen": arr![validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Enter address line 1",
            "groups": arr!["address"],
        })],
    })
}

pub fn address_line2_field() -> D {
    component(&govuk::TEXT_INPUT, obj! {
        "code": "addressLine2",
        "label": obj! { "text": "Address line 2 (optional)" },
        "autocomplete": "address-line2",
    })
}

pub fn address_town_field() -> D {
    component(&govuk::TEXT_INPUT, obj! {
        "code": "addressTown",
        "label": obj! { "text": "Town or city" },
        "autocomplete": "address-level2",
        "classes": D::from(forge_govuk_components::utility_classes()).get("Input").get("Width20"),
        "validWhen": arr![validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Enter a town or city",
            "groups": arr!["address"],
        })],
    })
}

pub fn address_county_field() -> D {
    component(&govuk::TEXT_INPUT, obj! {
        "code": "addressCounty",
        "label": obj! { "text": "County (optional)" },
        "classes": D::from(forge_govuk_components::utility_classes()).get("Input").get("Width20"),
    })
}

pub fn address_postcode_field() -> D {
    component(&govuk::TEXT_INPUT, obj! {
        "code": "addressPostcode",
        "label": obj! { "text": "Postcode" },
        "autocomplete": "postal-code",
        "classes": D::from(forge_govuk_components::utility_classes()).get("Input").get("Width10"),
        "validWhen": arr![validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Enter a postcode",
            "groups": arr!["address"],
        })],
    })
}

pub fn button_group() -> D {
    component(&govuk::BUTTON_GROUP, obj! {
        "buttons": arr![component(&govuk::BUTTON, obj! { "text": "Continue", "name": "action", "value": "continue" })],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        let _ = heading();
        let _ = postcode_field();
        let _ = find_address_button();
        let _ = address_line1_field();
        let _ = address_line2_field();
        let _ = address_town_field();
        let _ = address_county_field();
        let _ = address_postcode_field();
        let _ = button_group();
    });
}
