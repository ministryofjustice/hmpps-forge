//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/load-reference-data/demo/draw/blocks.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::support::lottery_ball;

pub fn heading() -> D {
    component(&govuk::HEADING, obj! { "text": "Your lottery draw", "size": "l" })
}

pub fn draw_date() -> D {
    component(&govuk::BODY, obj! { "text": format("Drawn on %1", vec![data("drawDate")]) })
}

pub fn numbers_row() -> D {
    component(&core_blocks::TEMPLATE_WRAPPER, obj! {
        "template": "<div class=\"lottery-ball-row\">{{slot:balls}}</div>",
        "slots": obj! {
            "balls": arr![
                lottery_ball(obj! { "number": data("ball1") }),
                lottery_ball(obj! { "number": data("ball2") }),
                lottery_ball(obj! { "number": data("ball3") }),
                lottery_ball(obj! { "number": data("ball4") }),
                lottery_ball(obj! { "number": data("ball5") }),
                lottery_ball(obj! { "number": data("ball6") }),
            ],
        },
    })
}

pub fn section_break() -> D {
    component(&govuk::SECTION_BREAK, obj! { "size": "m", "visible": true })
}

pub fn bonus_ball_label() -> D {
    component(&govuk::HEADING, obj! { "text": "Bonus ball", "size": "m" })
}

pub fn bonus_ball() -> D {
    lottery_ball(obj! { "number": data("bonusBall"), "color": "green", "classes": "lottery-ball--block" })
}

pub fn draw_again_button() -> D {
    component(&govuk::LINK_BUTTON, obj! {
        "text": "Draw again",
        "href": "/forge-developer-guide/patterns/demos/load-reference-data/draw",
        "classes": "govuk-button--secondary",
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        let _ = heading();
        let _ = draw_date();
        let _ = numbers_row();
        let _ = section_break();
        let _ = bonus_ball_label();
        let _ = bonus_ball();
        let _ = draw_again_button();
    });
}
