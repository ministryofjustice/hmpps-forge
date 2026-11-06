use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;
use forge_core::builtins::components as core_blocks;
use crate::components::lottery_ball::LOTTERY_BALL;

pub fn heading() -> Value {
    govuk::HEADING.build(obj! { "text": "Your lottery draw", "size": "l" })
}

pub fn draw_date() -> Value {
    govuk::BODY.build(obj! {
        "text": format("Drawn on %1", [data("drawDate").into()]),
    })
}

pub fn numbers_row() -> Value {
    core_blocks::TEMPLATE_WRAPPER.build(obj! {
        "template": "<div class=\"lottery-ball-row\">{{slot:balls}}</div>",
        "slots": obj! {
            "balls": [
                LOTTERY_BALL.build(obj! { "number": data("ball1") }),
                LOTTERY_BALL.build(obj! { "number": data("ball2") }),
                LOTTERY_BALL.build(obj! { "number": data("ball3") }),
                LOTTERY_BALL.build(obj! { "number": data("ball4") }),
                LOTTERY_BALL.build(obj! { "number": data("ball5") }),
                LOTTERY_BALL.build(obj! { "number": data("ball6") }),
            ],
        },
    })
}

pub fn section_break() -> Value {
    govuk::SECTION_BREAK.build(obj! { "size": "m", "visible": true })
}

pub fn bonus_ball_label() -> Value {
    govuk::HEADING.build(obj! { "text": "Bonus ball", "size": "m" })
}

pub fn bonus_ball() -> Value {
    LOTTERY_BALL.build(obj! {
        "number": data("bonusBall"),
        "color": "green",
        "classes": "lottery-ball--block",
    })
}

pub fn draw_again_button() -> Value {
    govuk::LINK_BUTTON.build(obj! {
        "text": "Draw again",
        "href": "/forge-developer-guide/patterns/demos/load-reference-data/draw",
        "classes": "govuk-button--secondary",
    })
}
