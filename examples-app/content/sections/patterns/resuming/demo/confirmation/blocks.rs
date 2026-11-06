use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

pub fn panel() -> Value {
    govuk::PANEL.build(obj! {
        "titleText": "Answers submitted",
    })
}

pub fn next_steps() -> Value {
    govuk::BODY.build(obj! {
        "text": "Restart the pattern to try the resume flow again.",
    })
}

pub fn restart_button() -> Value {
    govuk::BUTTON.build(obj! {
        "text": "Restart pattern",
        "name": "action",
        "value": "restart",
        "classes": "govuk-button--secondary",
    })
}
