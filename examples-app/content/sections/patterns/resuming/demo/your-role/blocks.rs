use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;
use forge_govuk_components::classes;

pub fn role_field() -> Value {
    govuk::TEXT_INPUT.build(obj! {
        "code": "role",
        "label": obj! {
            "text": "What is your role?",
            "classes": classes::label::LARGE,
            "isPageHeading": true,
        },
        "hint": obj! { "text": "For example, developer, designer, or product manager." },
        "classes": classes::input::WIDTH_30,
        "formatters": [transformer::string::trim()],
        "validWhen": [
            validation(obj! {
                "condition": self_().matches(condition::is_required()),
                "message": "Enter your role",
            }),
            validation(obj! {
                "condition": self_().matches(condition::string::has_max_length(100)),
                "message": "Role must be 100 characters or less",
            }),
        ],
    })
}

pub fn continue_button() -> Value {
    govuk::BUTTON.build(obj! { "text": "Continue" })
}
