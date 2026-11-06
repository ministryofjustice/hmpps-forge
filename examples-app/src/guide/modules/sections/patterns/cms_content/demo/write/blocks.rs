//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/cms-content/demo/write/blocks.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::support::rich_text_editor;

pub fn heading() -> D {
    component(&govuk::HEADING, obj! { "text": "Write a post", "size": "l" })
}

pub fn title_input() -> D {
    component(&govuk::TEXT_INPUT, obj! {
        "code": "postTitle",
        "label": obj! { "text": "Title", "classes": "govuk-label--m" },
        "validWhen": arr![validation(obj! { "condition": self_().matches(condition::is_required()), "message": "Enter a title" })],
    })
}

pub fn body_editor() -> D {
    rich_text_editor(obj! {
        "code": "postBody",
        "label": obj! { "text": "Content", "classes": "govuk-label--m" },
        "hint": "Use the toolbar to format your post.",
        "validWhen": arr![validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Enter some content",
        })],
    })
}

pub fn publish_button() -> D {
    component(&govuk::BUTTON, obj! { "text": "Publish post" })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        let _ = heading();
        let _ = title_input();
        let _ = body_editor();
        let _ = publish_button();
    });
}
