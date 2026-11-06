use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

pub fn panel() -> Value {
    govuk::PANEL.build(obj! {
        "titleText": "Address saved",
    })
}

pub fn next_steps() -> Value {
    govuk::BODY.build(obj! {
        "text": "Your address has been stored in the session. Reload any step to see the pre-filled values.",
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
