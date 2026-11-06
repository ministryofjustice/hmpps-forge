use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

pub fn panel() -> Value {
    govuk::PANEL.build(obj! {
        "titleText": "Visit booked",
    })
}

pub fn next_steps() -> Value {
    govuk::BODY.build(obj! {
        "text": "Your answers have been stored in the session. Restart the pattern to clear them and try a different branch.",
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
