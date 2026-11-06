//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/cms-content/demo/overview/blocks.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;


pub fn heading() -> D {
    component(&govuk::HEADING, obj! { "text": "CMS content", "size": "l", "caption": "Pattern" })
}

pub fn intro() -> D {
    component(&govuk::BODY, obj! {
        "text": "A simple blog-style CMS where users write posts using a rich text\n  editor and view them on a separate page. Content is stored in the\n  session and rendered as HTML. This pattern shows how to integrate a\n  third-party editor component with Forge's form submission flow.",
    })
}

pub fn shows() -> D {
    component(&govuk::HEADING, obj! { "text": "What this pattern shows", "size": "s" })
}

pub fn shows_list() -> D {
    component(&govuk::LIST, obj! {
        "items": literal(arr![
            "A custom rich text editor component wrapping the MOJ Rich Text Editor",
            "Saving user-generated HTML content via effects",
            "Rendering dynamic HTML content with CollectionBlock and HtmlBlock",
            "Session-based content storage for a multi-step authoring flow",
        ]),
        "style": "bullet",
    })
}

pub fn start_button() -> D {
    component(&govuk::LINK_BUTTON, obj! {
        "text": "Start the pattern",
        "href": "/forge-developer-guide/patterns/demos/cms-content/posts",
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
