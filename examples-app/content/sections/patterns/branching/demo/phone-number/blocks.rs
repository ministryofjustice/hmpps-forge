use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;
use forge_govuk_components::classes;

pub fn phone_number_field() -> Value {
    govuk::TEXT_INPUT.build(obj! {
        "code": "phoneNumber",
        "label": obj! {
            "text": "What number should we call you on?",
            "classes": classes::label::LARGE,
            "isPageHeading": true,
        },
        "inputType": "tel",
        "autocomplete": "tel",
        "classes": classes::input::WIDTH_20,
        "formatters": [transformer::string::trim()],
        "validWhen": [
            validation(obj! {
                "condition": self_().matches(condition::is_required()),
                "message": "Enter a phone number",
            }),
            validation(obj! {
                "condition": self_().matches(condition::phone::is_valid_phone_number()),
                "message": "Enter a valid phone number",
            }),
        ],
    })
}

pub fn continue_button() -> Value {
    govuk::BUTTON.build(obj! { "text": "Continue" })
}
