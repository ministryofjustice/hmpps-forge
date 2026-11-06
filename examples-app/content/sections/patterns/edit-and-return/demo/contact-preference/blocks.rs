use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;
use forge_govuk_components::classes;

pub fn contact_preference_field() -> Value {
    govuk::RADIO_INPUT.build(obj! {
        "code": "contactPreference",
        "fieldset": obj! {
            "legend": obj! {
                "text": "How would you prefer to be contacted?",
                "classes": classes::fieldset::LARGE_LABEL,
                "isPageHeading": true,
            },
        },
        "items": [
            obj! { "value": "email", "text": "Email" },
            obj! { "value": "phone", "text": "Phone" },
            obj! { "value": "post", "text": "Post" },
        ],
        "validWhen": [
            validation(obj! {
                "condition": self_().matches(condition::is_required()),
                "message": "Select how you would prefer to be contacted",
            }),
        ],
    })
}

pub fn continue_button() -> Value {
    govuk::BUTTON.build(obj! { "text": "Continue" })
}
