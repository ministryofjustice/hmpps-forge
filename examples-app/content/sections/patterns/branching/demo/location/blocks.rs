use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;
use forge_govuk_components::classes;

pub fn location_field() -> Value {
    govuk::RADIO_INPUT.build(obj! {
        "code": "location",
        "fieldset": obj! {
            "legend": obj! {
                "text": "Which office would you like to visit?",
                "classes": classes::fieldset::LARGE_LABEL,
                "isPageHeading": true,
            },
        },
        "items": [
            obj! { "value": "london", "text": "London" },
            obj! { "value": "manchester", "text": "Manchester" },
            obj! { "value": "cardiff", "text": "Cardiff" },
            obj! { "value": "edinburgh", "text": "Edinburgh" },
        ],
        "validWhen": [
            validation(obj! {
                "condition": self_().matches(condition::is_required()),
                "message": "Select an office",
            }),
        ],
    })
}

pub fn continue_button() -> Value {
    govuk::BUTTON.build(obj! { "text": "Continue" })
}
