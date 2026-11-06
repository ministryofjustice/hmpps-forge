use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;
use forge_core::builtins::components as core_blocks;

pub fn heading() -> Value {
    govuk::HEADING.build(obj! {
        "text": "Add actions to goals",
        "size": "l",
        "caption": "Collection validation demo",
    })
}

pub fn intro() -> Value {
    govuk::BODY.build(obj! {
        "text": "Each active goal needs at least one action before the plan can be agreed. Add an action to each goal below.",
    })
}

pub fn goal_actions() -> Value {
    core_blocks::COLLECTION_BLOCK.build(obj! {
        "collection": data("activeGoals").each(iterator::map([
            govuk::HEADING.build(obj! { "text": item().path("title"), "size": "s" }),
            govuk::TEXT_INPUT.build(obj! {
                "code": format("action_%1", [Loop.index0().into()]),
                "label": obj! { "text": "Action" },
                "hint": obj! { "text": "Describe what needs to happen to achieve this goal" },
            }),
        ])),
        "fallback": [govuk::BODY.build(obj! { "text": "No active goals to manage." })],
    })
}

pub fn continue_button() -> Value {
    govuk::BUTTON.build(obj! { "text": "Save and continue" })
}
