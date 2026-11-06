use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

pub fn heading() -> Value {
    govuk::HEADING.build(obj! {
        "text": "What type of visit do you want?",
        "size": "l",
    })
}

pub fn visit_type_field() -> Value {
    govuk::RADIO_INPUT.build(obj! {
        "code": "visitType",
        "fieldset": obj! {
            "legend": obj! {
                "text": "Type of visit",
                "classes": "govuk-fieldset__legend--m",
            },
        },
        "items": [
            obj! { "value": "in-person", "text": "In person" },
            obj! { "value": "video", "text": "Video call" },
        ],
        "validWhen": [
            validation(obj! {
                "condition": self_().matches(condition::is_required()),
                "message": "Select a type of visit",
                "submissionOnly": true,
            }),
        ],
    })
}

pub fn continue_button() -> Value {
    govuk::BUTTON.build(obj! { "text": "Save and return" })
}
