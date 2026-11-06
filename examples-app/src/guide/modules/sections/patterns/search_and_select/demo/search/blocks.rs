//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/search-and-select/demo/search/blocks.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;


pub fn heading() -> D {
    component(&govuk::HEADING, obj! { "text": "Search stations", "size": "l" })
}

pub fn search_input() -> D {
    component(&govuk::TEXT_INPUT, obj! {
        "code": "searchQuery",
        "label": obj! { "text": "Station name" },
        "hint": obj! { "text": "Try searching for King, Brixton, or Piccadilly" },
        "classes": D::from(forge_govuk_components::utility_classes()).get("Input").get("Width20"),
    })
}

pub fn search_button() -> D {
    component(&govuk::BUTTON, obj! { "text": "Search" })
}

pub fn results_heading() -> D {
    component(&govuk::HEADING, obj! {
        "text": "Results",
        "size": "m",
        "visibleWhen": data("hasSearched").matches(condition::is_required()),
    })
}

pub fn results_list() -> D {
    component(&core_blocks::COLLECTION_BLOCK, obj! {
        "collection": data("searchResults").each(iterator::map(component(&core_blocks::HTML, obj! {
            "tag": "div",
            "classes": "govuk-!-margin-bottom-6",
            "content": arr![
                component(&govuk::HEADING, obj! { "text": item().path("name"), "size": "s" }),
                component(&govuk::BODY, obj! {
                    "text": format("Lines: %1 — Zone %2", vec![item().path("lines"), item().path("zone")]),
                    "size": "s",
                }),
                component(&core_blocks::HTML, obj! {
                    "tag": "a",
                    "classes": "govuk-link",
                    "attributes": obj! { "href": item().path("href") },
                    "content": "View station details",
                }),
            ],
        }))),
        "fallback": arr![component(&govuk::INSET_TEXT, obj! {
            "text": "No matching stations found.",
            "visibleWhen": data("hasSearched").matches(condition::is_required()),
        })],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        let _ = heading();
        let _ = search_input();
        let _ = search_button();
        let _ = results_heading();
        let _ = results_list();
    });
}
