//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/pagination/demo/list/blocks.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;


pub fn heading() -> D {
    component(&govuk::HEADING, obj! { "text": "Stations", "size": "l" })
}

pub fn page_info() -> D {
    component(&govuk::BODY, obj! {
        "text": format("Page %1 of %2", vec![data("currentPage"), data("pages").pipe(vec![D::from(transformer::array::length())])]),
        "classes": "govuk-!-margin-bottom-6",
    })
}

pub fn station_list() -> D {
    component(&core_blocks::COLLECTION_BLOCK, obj! {
        "collection": data("stations").each(iterator::map(component(&core_blocks::HTML, obj! {
            "tag": "div",
            "classes": "govuk-!-margin-bottom-4",
            "content": arr![
                component(&core_blocks::HTML, obj! {
                    "tag": "a",
                    "classes": "govuk-link govuk-heading-s govuk-!-margin-bottom-1",
                    "attributes": obj! { "href": item().path("href") },
                    "content": item().path("name"),
                }),
                component(&govuk::BODY, obj! {
                    "text": format("Lines: %1 — Zone %2", vec![item().path("lines"), item().path("zone")]),
                    "size": "s",
                }),
            ],
        }))),
    })
}

pub fn pagination() -> D {
    component(&govuk::PAGINATION, obj! {
        "previous": obj! {
            "href": format("?page=%1", vec![data("currentPage").pipe(vec![D::from(transformer::number::add(D::from(-1.0f64)))])]),
            "visibleWhen": data("currentPage").matches(condition::number::greater_than(1.0)),
        },
        "next": obj! {
            "href": format("?page=%1", vec![data("currentPage").pipe(vec![D::from(transformer::number::add(1.0))])]),
            "visibleWhen": data("currentPage").matches(condition::number::less_than(data("pages").pipe(vec![D::from(transformer::array::length())]))),
        },
        "items": data("pages").each(iterator::map(obj! {
            "number": Loop.index(),
            "href": format("?page=%1", vec![Loop.index()]),
            "current": Loop.index().matches(condition::equals(data("currentPage"))),
        })),
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        let _ = heading();
        let _ = page_info();
        let _ = station_list();
        let _ = pagination();
    });
}
