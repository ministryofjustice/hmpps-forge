//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/cms-content/demo/posts/blocks.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;


pub fn heading() -> D {
    component(&govuk::HEADING, obj! { "text": "Blog posts", "size": "l" })
}

pub fn post_count() -> D {
    component(&govuk::BODY, obj! {
        "text": format("%1 posts published", vec![data("postCount")]),
        "visibleWhen": data("postCount").matches(condition::is_required()),
    })
}

pub fn write_button() -> D {
    component(&govuk::LINK_BUTTON, obj! {
        "text": "Write a new post",
        "href": "/forge-developer-guide/patterns/demos/cms-content/write",
        "classes": "govuk-button--secondary",
    })
}

pub fn posts_list() -> D {
    component(&core_blocks::COLLECTION_BLOCK, obj! {
        "collection": data("posts").each(iterator::map(component(&core_blocks::HTML, obj! {
            "tag": "article",
            "classes": "govuk-!-margin-bottom-8",
            "content": arr![
                component(&govuk::HEADING, obj! { "text": item().path("title"), "size": "m" }),
                component(&govuk::BODY, obj! {
                    "text": item().path("date"),
                    "size": "s",
                    "classes": "govuk-!-colour-secondary",
                }),
                component(&core_blocks::HTML, obj! { "content": item().path("body") }),
                component(&core_blocks::HTML, obj! {
                    "tag": "hr",
                    "classes": "govuk-section-break govuk-section-break--visible govuk-!-margin-top-6",
                }),
            ],
        }))),
    })
}

pub fn empty_state() -> D {
    component(&govuk::INSET_TEXT, obj! {
        "text": "No posts yet. Write your first post to get started.",
        "visibleWhen": data("postCount").not().matches(condition::is_required()),
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        let _ = heading();
        let _ = post_count();
        let _ = write_button();
        let _ = posts_list();
        let _ = empty_state();
    });
}
