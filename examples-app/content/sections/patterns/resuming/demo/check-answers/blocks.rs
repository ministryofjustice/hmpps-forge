use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

pub fn heading() -> Value {
    govuk::HEADING.build(obj! {
        "text": "Check your answers",
    })
}

pub fn summary_list() -> Value {
    govuk::SUMMARY_LIST.build(obj! {
        "rows": [
            obj! {
                "key": obj! { "text": "Name" },
                "value": obj! { "text": answer("fullName") },
                "actions": obj! {
                    "items": [obj! { "href": "your-name", "text": "Change", "visuallyHiddenText": "name" }],
                },
            },
            obj! {
                "key": obj! { "text": "Role" },
                "value": obj! { "text": answer("role") },
                "actions": obj! {
                    "items": [obj! { "href": "your-role", "text": "Change", "visuallyHiddenText": "role" }],
                },
            },
        ],
    })
}

pub fn confirm_body() -> Value {
    govuk::BODY.build(obj! {
        "text": "Selecting \"Confirm\" will save your answers.",
    })
}

pub fn submit_button() -> Value {
    govuk::BUTTON.build(obj! { "text": "Confirm", "name": "action", "value": "confirm" })
}
