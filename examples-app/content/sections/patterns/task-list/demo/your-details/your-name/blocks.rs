use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;
use forge_govuk_components::classes;

pub fn heading() -> Value {
    govuk::HEADING.build(obj! {
        "text": "What is your full name?",
        "size": "l",
    })
}

pub fn name_field() -> Value {
    govuk::TEXT_INPUT.build(obj! {
        "code": "visitorName",
        "label": obj! {
            "text": "Full name",
            "classes": classes::label::MEDIUM,
        },
        "validWhen": [
            validation(obj! {
                "condition": self_().matches(condition::is_required()),
                "message": "Enter your full name",
                "submissionOnly": true,
            }),
        ],
    })
}

pub fn continue_button() -> Value {
    govuk::BUTTON.build(obj! { "text": "Continue" })
}
