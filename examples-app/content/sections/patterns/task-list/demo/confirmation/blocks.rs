use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

pub fn panel() -> Value {
    govuk::PANEL.build(obj! {
        "titleText": "Application submitted",
        "text": "Your visit request has been sent.",
    })
}

pub fn what_next() -> Value {
    govuk::BODY.build(obj! {
        "text": "We will review your application and send a confirmation email within 3 working days.",
    })
}

// Posts action='restart' to trigger the onSubmission handler that resets the journey
pub fn restart_button() -> Value {
    govuk::BUTTON.build(obj! {
        "text": "Start a new application",
        "name": "action",
        "value": "restart",
        "classes": "govuk-button--secondary",
    })
}
