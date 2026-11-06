//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/pagination/demo/detail/blocks.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;


pub fn heading() -> D {
    component(&govuk::HEADING, obj! { "text": data("stationName"), "size": "l" })
}

pub fn details() -> D {
    component(&govuk::SUMMARY_LIST, obj! {
        "rows": arr![
            obj! { "key": obj! { "text": "Lines" }, "value": obj! { "text": data("stationLines") } },
            obj! { "key": obj! { "text": "Zone" }, "value": obj! { "text": data("stationZone") } },
            obj! {
                "key": obj! { "text": "Opened" },
                "value": obj! { "text": data("stationOpened") },
            },
        ],
    })
}

pub fn description() -> D {
    component(&govuk::BODY, obj! { "text": data("stationDescription") })
}

pub fn back_button() -> D {
    component(&govuk::LINK_BUTTON, obj! {
        "text": "Back to list",
        "href": format(
            "/forge-developer-guide/patterns/demos/pagination/list?page=%1",
            vec![data("stationPage")],
        ),
        "classes": "govuk-button--secondary",
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        let _ = heading();
        let _ = details();
        let _ = description();
        let _ = back_button();
    });
}
