use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;
use forge_govuk_components::classes;

pub fn email_field() -> Value {
    govuk::TEXT_INPUT.build(obj! {
        "code": "emailAddress",
        "label": obj! {
            "text": "What is your email address?",
            "classes": classes::label::LARGE,
            "isPageHeading": true,
        },
        "autocomplete": "email",
        "classes": classes::input::WIDTH_20,
        "validWhen": [
            validation(obj! {
                "condition": self_().matches(condition::is_required()),
                "message": "Enter your email address",
            }),
        ],
    })
}

pub fn continue_button() -> Value {
    govuk::BUTTON.build(obj! { "text": "Continue" })
}
