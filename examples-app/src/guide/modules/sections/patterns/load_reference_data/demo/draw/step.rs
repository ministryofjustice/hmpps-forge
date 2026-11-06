//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/load-reference-data/demo/draw/step.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::patterns::load_reference_data::demo::draw::blocks::bonus_ball;
use crate::guide::modules::sections::patterns::load_reference_data::demo::draw::blocks::bonus_ball_label;
use crate::guide::modules::sections::patterns::load_reference_data::demo::draw::blocks::draw_again_button;
use crate::guide::modules::sections::patterns::load_reference_data::demo::draw::blocks::draw_date;
use crate::guide::modules::sections::patterns::load_reference_data::demo::draw::blocks::heading;
use crate::guide::modules::sections::patterns::load_reference_data::demo::draw::blocks::numbers_row;
use crate::guide::modules::sections::patterns::load_reference_data::demo::draw::blocks::section_break;
use crate::guide::support::pattern_step;

pub fn draw_step() -> D {
    pattern_step(obj! {
        "path": "/draw",
        "title": "Your lottery draw",
        "reachability": obj! { "entryWhen": true },
        "metadata": obj! { "hiddenFromNav": true },
        "blocks": arr![
            heading(),
            draw_date(),
            numbers_row(),
            section_break(),
            bonus_ball_label(),
            bonus_ball(),
            draw_again_button(),
        ],
        "sourceBase": "load-reference-data/demo",
        "codeFiles": arr![
            "draw/blocks.rs",
            obj! { "path": "/../../components/lottery_ball.rs" },
            obj! { "path": "/effects.rs", "effects": arr!["DrawLotteryNumbers"] },
        ],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::patterns::load_reference_data::demo::draw::blocks::__init();
        let _ = draw_step();
    });
}
