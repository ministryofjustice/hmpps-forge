use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;
use forge_govuk_components::classes;

pub fn heading() -> Value {
    govuk::HEADING.build(obj! {
        "text": "Do you have any additional needs?",
        "size": "l",
    })
}

pub fn hint() -> Value {
    govuk::BODY.build(obj! {
        "text": "Tell us about any accessibility requirements, dietary needs, or other support you need during your visit. Enter \"None\" if you have no additional needs.",
    })
}

pub fn additional_needs_field() -> Value {
    govuk::TEXTAREA.build(obj! {
        "code": "additionalNeeds",
        "label": obj! {
            "text": "Additional needs",
            "classes": classes::label::MEDIUM,
        },
        "rows": 4,
        "validWhen": [
            validation(obj! {
                "condition": self_().matches(condition::is_required()),
                "message": "Enter your additional needs or \"None\"",
                "submissionOnly": true,
            }),
        ],
    })
}

pub fn continue_button() -> Value {
    govuk::BUTTON.build(obj! { "text": "Save and return" })
}
