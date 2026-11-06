use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

pub fn heading() -> Value {
    govuk::HEADING.build(obj! {
        "text": "Which day would you prefer to visit?",
        "size": "l",
    })
}

pub fn day_field() -> Value {
    govuk::RADIO_INPUT.build(obj! {
        "code": "preferredDay",
        "fieldset": obj! {
            "legend": obj! {
                "text": "Preferred day",
                "classes": "govuk-fieldset__legend--m",
            },
        },
        "items": [
            obj! { "value": "monday", "text": "Monday" },
            obj! { "value": "wednesday", "text": "Wednesday" },
            obj! { "value": "friday", "text": "Friday" },
            obj! { "value": "saturday", "text": "Saturday" },
        ],
        "validWhen": [
            validation(obj! {
                "condition": self_().matches(condition::is_required()),
                "message": "Select a preferred day",
                "submissionOnly": true,
            }),
        ],
    })
}

pub fn continue_button() -> Value {
    govuk::BUTTON.build(obj! { "text": "Continue" })
}
