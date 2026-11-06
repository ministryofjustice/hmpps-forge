use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

pub fn heading() -> Value {
    govuk::HEADING.build(obj! {
        "text": "Check your answers",
    })
}

// The radio value is machine-readable ('social-media'), so map it to a display
// label with match(). The two follow-up rows use visibleWhen so they only show
// when the user picked the option that revealed them on the previous step.
pub fn heard_from_label() -> Value {
    match_(answer("heardFrom")).branch(condition::equals("search-engine"), "Search engine").branch(condition::equals("social-media"), "Social media").branch(condition::equals("friend-or-colleague"), "Friend or colleague").branch(condition::equals("other"), "Other").otherwise("").into()
}

pub fn summary_list() -> Value {
    govuk::SUMMARY_LIST.build(obj! {
        "rows": [
            obj! {
                "key": obj! { "text": "How you heard about us" },
                "value": obj! { "text": heard_from_label() },
                "actions": obj! {
                    "items": [
                        obj! {
                            "href": "heard-from",
                            "text": "Change",
                            "visuallyHiddenText": "how you heard about us",
                        },
                    ],
                },
            },
            obj! {
                "key": obj! { "text": "Platform" },
                "value": obj! { "text": answer("socialMediaSource") },
                "actions": obj! {
                    "items": [
                        obj! {
                            "href": "heard-from",
                            "text": "Change",
                            "visuallyHiddenText": "the platform",
                        },
                    ],
                },
                "visibleWhen": answer("heardFrom").matches(condition::equals("social-media")),
            },
            obj! {
                "key": obj! { "text": "Details" },
                "value": obj! { "text": answer("otherSource") },
                "actions": obj! {
                    "items": [
                        obj! {
                            "href": "heard-from",
                            "text": "Change",
                            "visuallyHiddenText": "the details",
                        },
                    ],
                },
                "visibleWhen": answer("heardFrom").matches(condition::equals("other")),
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
