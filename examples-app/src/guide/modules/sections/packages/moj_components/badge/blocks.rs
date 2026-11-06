//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/packages/moj-components/badge/blocks.ts`.

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
fn badge_html(text: D, classes: D) -> D {
    template(vec![
        D::from("<strong class=\"moj-badge "),
        classes.clone(),
        D::from("\">"),
        text.clone(),
        D::from("</strong>"),
    ])
}

fn basic_example() -> D {
    component(&moj::BADGE, obj! { "text": "Complete", "classes": "moj-badge--green" })
}

fn colours_example() -> D {
    component(&core_blocks::TEMPLATE_WRAPPER, obj! {
        "template": "{{slot:table}}",
        "slots": obj! {
            "table": arr![component(&govuk::TABLE, obj! {
                "head": arr![obj! { "text": "Badge" }, obj! { "text": "Class" }],
                "rows": arr![
                    arr![
                        obj! { "html": badge_html(D::from("Urgent"), D::from("moj-badge--red")) },
                        obj! { "html": "<code>moj-badge--red</code>" },
                    ],
                    arr![
                        obj! {
                            "html": badge_html(D::from("In review"), D::from("moj-badge--blue")),
                        },
                        obj! { "html": "<code>moj-badge--blue</code>" },
                    ],
                    arr![
                        obj! {
                            "html": badge_html(D::from("Complete"), D::from("moj-badge--green")),
                        },
                        obj! { "html": "<code>moj-badge--green</code>" },
                    ],
                    arr![
                        obj! {
                            "html": badge_html(D::from("Paused"), D::from("moj-badge--dark-grey")),
                        },
                        obj! { "html": "<code>moj-badge--dark-grey</code>" },
                    ],
                ],
            })],
        },
    })
}

pub fn content() -> D {
    govuk_markdown_block(obj! {
        "content": data("content"),
        "slots": obj! {
            "toc": arr![table_of_contents(obj! { "headings": data("headings") })],
            "basic-example": arr![live_display(arr![basic_example()])],
            "colours-example": arr![live_display(arr![colours_example()])],
        },
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        let _ = basic_example();
        let _ = colours_example();
        let _ = content();
    });
}
