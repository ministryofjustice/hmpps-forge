use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;
use forge_govuk_components::classes;

pub fn full_name_field() -> Value {
    govuk::TEXT_INPUT.build(obj! {
        "code": "fullName",
        "label": obj! {
            "text": "What is your name?",
            "classes": classes::label::LARGE,
            "isPageHeading": true,
        },
        "autocomplete": "name",
        "classes": classes::input::WIDTH_20,
        "formatters": [transformer::string::trim()],
        "validWhen": [
            validation(obj! {
                "condition": self_().matches(condition::is_required()),
                "message": "Enter your name",
            }),
            validation(obj! {
                "condition": self_().matches(condition::string::has_max_length(100)),
                "message": "Name must be 100 characters or less",
            }),
        ],
    })
}

pub fn continue_button() -> Value {
    govuk::BUTTON.build(obj! { "text": "Continue" })
}
