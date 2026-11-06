use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;
use forge_govuk_components::classes;

pub fn video_email_field() -> Value {
    govuk::TEXT_INPUT.build(obj! {
        "code": "videoEmail",
        "label": obj! {
            "text": "What email should we send the invite to?",
            "classes": classes::label::LARGE,
            "isPageHeading": true,
        },
        "hint": obj! { "text": "We will send a calendar invite with the video call details." },
        "inputType": "email",
        "autocomplete": "email",
        "classes": classes::input::WIDTH_20,
        "formatters": [transformer::string::trim(), transformer::string::to_lower_case()],
        "validWhen": [
            validation(obj! {
                "condition": self_().matches(condition::is_required()),
                "message": "Enter an email address",
            }),
            validation(obj! {
                "condition": self_().matches(condition::email::is_valid_email()),
                "message": "Enter a valid email address",
            }),
        ],
    })
}

pub fn continue_button() -> Value {
    govuk::BUTTON.build(obj! { "text": "Continue" })
}
