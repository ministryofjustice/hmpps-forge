//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/packages/moj-components/date-picker/blocks.ts`.

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

#[allow(unused_variables)]
fn live_display(blocks: D) -> D {
    component(&core_blocks::TEMPLATE_WRAPPER, obj! {
        "template": "{{slot:content}}",
        "classes": "live-example",
        "slots": obj! { "content": blocks.clone() },
    })
}

fn basic_example() -> D {
    component(&moj::DATE_PICKER, obj! {
        "code": "appointmentDate",
        "label": "Appointment date",
        "hint": "For example, 17/5/2026",
    })
}

fn limits_example() -> D {
    component(&moj::DATE_PICKER, obj! {
        "code": "visitDate",
        "label": "Visit date",
        "hint": "Choose a weekday in May 2026.",
        "minDate": "01/05/2026",
        "maxDate": "31/05/2026",
        "excludedDays": arr!["saturday", "sunday"],
    })
}

pub fn content() -> D {
    govuk_markdown_block(obj! {
        "content": data("content"),
        "slots": obj! {
            "toc": arr![table_of_contents(obj! { "headings": data("headings") })],
            "basic-example": arr![live_display(arr![basic_example()])],
            "limits-example": arr![live_display(arr![limits_example()])],
        },
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        let _ = basic_example();
        let _ = limits_example();
        let _ = content();
    });
}
