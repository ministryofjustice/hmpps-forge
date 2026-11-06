//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/packages/moj-components/multi-select/blocks.ts`.

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

#[allow(unused_variables)]
fn checkbox_html(id: D, name: D, value: D) -> D {
    template(vec![
        D::from("<input type=\"checkbox\" class=\"govuk-checkboxes__input\" id=\""),
        id.clone(),
        D::from("\" name=\""),
        name.clone(),
        D::from("\" value=\""),
        value.clone(),
        D::from("\">"),
    ])
}

fn rows() -> D {
    arr![
        arr![
            obj! { "html": checkbox_html(D::from("person-1"), D::from("people"), D::from("1")) },
            obj! { "text": "John Smith" },
            obj! { "text": "Active" },
        ],
        arr![
            obj! { "html": checkbox_html(D::from("person-2"), D::from("people"), D::from("2")) },
            obj! { "text": "Jane Doe" },
            obj! { "text": "Pending" },
        ],
    ]
}

fn basic_example() -> D {
    component(&moj::MULTI_SELECT, obj! {
        "head": arr![
            obj! {
                "html": checkbox_html(D::from("select-all"), D::from("selectAll"), D::from("all")),
            },
            obj! { "text": "Name" },
            obj! { "text": "Status" },
        ],
        "rows": rows(),
    })
}

fn caption_example() -> D {
    component(&moj::MULTI_SELECT, obj! {
        "caption": "People to allocate",
        "captionClasses": "govuk-table__caption--m",
        "head": arr![
            obj! {
                "html": checkbox_html(
                    D::from("select-people"),
                    D::from("selectAllPeople"),
                    D::from("all"),
                ),
            },
            obj! { "text": "Name" },
            obj! { "text": "Status" },
        ],
        "rows": rows(),
    })
}

pub fn content() -> D {
    govuk_markdown_block(obj! {
        "content": data("content"),
        "slots": obj! {
            "toc": arr![table_of_contents(obj! { "headings": data("headings") })],
            "basic-example": arr![live_display(arr![basic_example()])],
            "caption-example": arr![live_display(arr![caption_example()])],
        },
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        let _ = rows();
        let _ = basic_example();
        let _ = caption_example();
        let _ = content();
    });
}
