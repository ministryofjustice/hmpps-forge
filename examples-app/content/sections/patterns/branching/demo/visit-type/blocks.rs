use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;
use forge_govuk_components::classes;

// A plain radio with three options. The selected value drives the redirect in
// the step's submit hook, so the field only needs a required rule here.
pub fn visit_type_field() -> Value {
    govuk::RADIO_INPUT.build(obj! {
        "code": "visitType",
        "fieldset": obj! {
            "legend": obj! {
                "text": "How would you like to meet?",
                "classes": classes::fieldset::LARGE_LABEL,
                "isPageHeading": true,
            },
        },
        "hint": obj! { "text": "Pick the option that works best for you." },
        "items": [
            obj! { "value": "in-person", "text": "In person" },
            obj! { "value": "video", "text": "Video call" },
            obj! { "value": "phone", "text": "Phone call" },
        ],
        "validWhen": [
            validation(obj! {
                "condition": self_().matches(condition::is_required()),
                "message": "Select how you would like to meet",
            }),
        ],
    })
}

pub fn continue_button() -> Value {
    govuk::BUTTON.build(obj! { "text": "Continue" })
}
