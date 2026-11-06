use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

pub fn heading() -> Value {
    govuk::HEADING.build(obj! {
        "text": "Check your answers",
    })
}

// visitTypeLabel uses match() to pick a friendly display value for the row
// that is always shown. The three branch rows each declare visibleWhen, so
// only the branch the user actually took appears on the summary. Answers
// from other branches stay in the session (so switching back shows the
// previous value pre-filled) but are not displayed here.
pub fn visit_type_label() -> Value {
    match_(answer("visitType")).branch(condition::equals("in-person"), "In person").branch(condition::equals("video"), "Video call").branch(condition::equals("phone"), "Phone call").otherwise("").into()
}

pub fn summary_list() -> Value {
    govuk::SUMMARY_LIST.build(obj! {
        "rows": [
            obj! {
                "key": obj! { "text": "How you would like to meet" },
                "value": obj! { "text": visit_type_label().clone() },
                "actions": obj! {
                    "items": [
                        obj! {
                            "href": "visit-type",
                            "text": "Change",
                            "visuallyHiddenText": "how you would like to meet",
                        },
                    ],
                },
            },
            obj! {
                "visibleWhen": answer("visitType").matches(condition::equals("in-person")),
                "key": obj! { "text": "Office" },
                "value": obj! { "text": answer("location").pipe([transformer::string::capitalize()]) },
                "actions": obj! {
                    "items": [obj! { "href": "location", "text": "Change", "visuallyHiddenText": "office" }],
                },
            },
            obj! {
                "visibleWhen": answer("visitType").matches(condition::equals("video")),
                "key": obj! { "text": "Invite email" },
                "value": obj! { "text": answer("videoEmail") },
                "actions": obj! {
                    "items": [
                        obj! {
                            "href": "video-email",
                            "text": "Change",
                            "visuallyHiddenText": "invite email",
                        },
                    ],
                },
            },
            obj! {
                "visibleWhen": answer("visitType").matches(condition::equals("phone")),
                "key": obj! { "text": "Phone number" },
                "value": obj! { "text": answer("phoneNumber") },
                "actions": obj! {
                    "items": [
                        obj! {
                            "href": "phone-number",
                            "text": "Change",
                            "visuallyHiddenText": "phone number",
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
