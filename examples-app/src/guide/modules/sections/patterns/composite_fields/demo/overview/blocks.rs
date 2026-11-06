//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/composite-fields/demo/overview/blocks.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;


pub fn heading() -> D {
    component(&govuk::HEADING, obj! { "text": "Multi-part composite fields", "size": "l", "caption": "Pattern" })
}

pub fn intro() -> D {
    component(&govuk::BODY, obj! {
        "text": "Fields that are conceptually one value, but collected\n  through several inputs. Two common flavours turn up: a\n  component that owns the composition internally (date of\n  birth), and separate fields laid out together that the author\n  composes at display time (a postal address).",
    })
}

pub fn shows() -> D {
    component(&govuk::HEADING, obj! { "text": "What this pattern shows", "size": "s" })
}

pub fn shows_list() -> D {
    component(&govuk::LIST, obj! {
        "items": literal(arr![
            "A component-owned composite with GovUKDateInputFull (day, month, year) that outputs one ISO date",
            "Pre-built field-specific validations for empty, missing part, and invalid date errors",
            "An author-owned composite where several text inputs on one step describe one address",
            "A summary list that formats the date and renders the address as multi-line output",
            "Optional fields that only contribute to the composed display when filled in",
        ]),
        "style": "bullet",
    })
}

pub fn start_button() -> D {
    component(&govuk::LINK_BUTTON, obj! {
        "text": "Start the pattern",
        "href": "/forge-developer-guide/patterns/demos/composite-fields/date-of-birth",
        "isStartButton": true,
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        let _ = heading();
        let _ = intro();
        let _ = shows();
        let _ = shows_list();
        let _ = start_button();
    });
}
