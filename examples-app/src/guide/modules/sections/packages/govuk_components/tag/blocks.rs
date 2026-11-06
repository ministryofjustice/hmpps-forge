//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/packages/govuk-components/tag/blocks.ts`.

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
fn tag_html(text: D, css_class: D) -> D {
    template(vec![
        D::from("<strong class=\"govuk-tag "),
        css_class.clone(),
        D::from("\">"),
        text.clone(),
        D::from("</strong>"),
    ])
}

fn basic_example() -> D {
    component(&govuk::TAG, obj! { "text": "Completed" })
}

fn colours_example() -> D {
    component(&govuk::TABLE, obj! {
        "head": arr![obj! { "text": "Tag" }, obj! { "text": "Class" }],
        "rows": arr![
            arr![
                obj! { "html": tag_html(D::from("Completed"), D::from("govuk-tag--green")) },
                obj! { "html": "<code>GovUKUtilityClasses.Tag.Green</code>" },
            ],
            arr![
                obj! { "html": tag_html(D::from("In progress"), D::from("govuk-tag--blue")) },
                obj! { "html": "<code>GovUKUtilityClasses.Tag.Blue</code>" },
            ],
            arr![
                obj! { "html": tag_html(D::from("Not started"), D::from("govuk-tag--grey")) },
                obj! { "html": "<code>GovUKUtilityClasses.Tag.Grey</code>" },
            ],
            arr![
                obj! { "html": tag_html(D::from("Overdue"), D::from("govuk-tag--red")) },
                obj! { "html": "<code>GovUKUtilityClasses.Tag.Red</code>" },
            ],
            arr![
                obj! { "html": tag_html(D::from("Pending"), D::from("govuk-tag--orange")) },
                obj! { "html": "<code>GovUKUtilityClasses.Tag.Orange</code>" },
            ],
            arr![
                obj! { "html": tag_html(D::from("New"), D::from("govuk-tag--yellow")) },
                obj! { "html": "<code>GovUKUtilityClasses.Tag.Yellow</code>" },
            ],
            arr![
                obj! { "html": tag_html(D::from("Draft"), D::from("govuk-tag--purple")) },
                obj! { "html": "<code>GovUKUtilityClasses.Tag.Purple</code>" },
            ],
            arr![
                obj! { "html": tag_html(D::from("Active"), D::from("govuk-tag--teal")) },
                obj! { "html": "<code>GovUKUtilityClasses.Tag.Teal</code>" },
            ],
            arr![
                obj! { "html": tag_html(D::from("Urgent"), D::from("govuk-tag--magenta")) },
                obj! { "html": "<code>GovUKUtilityClasses.Tag.Magenta</code>" },
            ],
        ],
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
