//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/composite-fields/demo/check-answers/blocks.ts`.

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

fn date_of_birth_display() -> D {
    answer("dateOfBirth").pipe(vec![D::from(transformer::string::to_date()), D::from(transformer::date::format("D MMMM YYYY"))])
}

fn address_display() -> D {
    function("FunctionType.Generator", "String", vec![D::V(obj! {
        "template": "\n    {{ line1 }}<br>\n    {% if line2 %}{{ line2 }}<br>{% endif %}\n    {{ town }}<br>\n    {{ postcode }}\n  ",
        "data": obj! {
            "line1": answer("addressLine1"),
            "line2": answer("addressLine2"),
            "town": answer("addressTown"),
            "postcode": answer("addressPostcode"),
        },
    })])
}

pub fn summary_list() -> D {
    component(&govuk::SUMMARY_LIST, obj! {
        "rows": arr![
            obj! {
                "key": obj! { "text": "Date of birth" },
                "value": obj! { "text": date_of_birth_display() },
                "actions": obj! {
                    "items": arr![obj! {
                        "href": "date-of-birth",
                        "text": "Change",
                        "visuallyHiddenText": "date of birth",
                    }],
                },
            },
            obj! {
                "key": obj! { "text": "Address" },
                "value": obj! { "html": address_display() },
                "actions": obj! {
                    "items": arr![obj! { "href": "address", "text": "Change", "visuallyHiddenText": "address" }],
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
        let _ = date_of_birth_display();
        let _ = address_display();
        let _ = summary_list();
        let _ = confirm_body();
        let _ = submit_button();
    });
}
