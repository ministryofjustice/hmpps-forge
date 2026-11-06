use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

pub fn panel() -> Value {
    govuk::PANEL.build(obj! {
        "titleText": "Plan agreed",
    })
}

pub fn next_steps() -> Value {
    govuk::BODY.build(obj! {
        "text": "The sentence plan has been agreed. Restart the pattern to clear the session and try again.",
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
