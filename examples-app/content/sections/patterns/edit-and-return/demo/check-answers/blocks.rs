use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

pub fn heading() -> Value {
    govuk::HEADING.build(obj! { "text": "Check your answers" })
}

// Each change link appends ?returnTo=check-answers so the question step
// knows to redirect back here after saving instead of continuing the
// linear flow.
pub fn summary_list() -> Value {
    govuk::SUMMARY_LIST.build(obj! {
        "rows": [
            obj! {
                "key": obj! { "text": "Full name" },
                "value": obj! { "text": answer("fullName") },
                "actions": obj! {
                    "items": [
                        obj! {
                            "href": "full-name?returnTo=check-answers",
                            "text": "Change",
                            "visuallyHiddenText": "full name",
                        },
                    ],
                },
            },
            obj! {
                "key": obj! { "text": "Email address" },
                "value": obj! { "text": answer("emailAddress") },
                "actions": obj! {
                    "items": [
                        obj! {
                            "href": "email-address?returnTo=check-answers",
                            "text": "Change",
                            "visuallyHiddenText": "email address",
                        },
                    ],
                },
            },
            obj! {
                "key": obj! { "text": "Contact preference" },
                "value": obj! {
                    "text": answer("contactPreference").pipe([transformer::string::capitalize()]),
                },
                "actions": obj! {
                    "items": [
                        obj! {
                            "href": "contact-preference?returnTo=check-answers",
                            "text": "Change",
                            "visuallyHiddenText": "contact preference",
                        },
                    ],
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
    govuk::BUTTON.build(obj! { "text": "Confirm" })
}
