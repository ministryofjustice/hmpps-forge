use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

pub fn heading() -> Value {
    govuk::HEADING.build(obj! {
        "text": "Check your answers",
        "size": "l",
    })
}

pub fn relationship_label() -> Value {
    match_(answer("relationship")).branch(condition::equals("partner"), "Partner or spouse").branch(condition::equals("parent"), "Parent").branch(condition::equals("child"), "Son or daughter").branch(condition::equals("sibling"), "Brother or sister").branch(condition::equals("friend"), "Friend").branch(condition::equals("legal"), "Legal representative").branch(condition::equals("other"), "Other").otherwise("").into()
}

pub fn day_label() -> Value {
    match_(answer("preferredDay")).branch(condition::equals("monday"), "Monday").branch(condition::equals("wednesday"), "Wednesday").branch(condition::equals("friday"), "Friday").branch(condition::equals("saturday"), "Saturday").otherwise("").into()
}

pub fn visit_type_label() -> Value {
    match_(answer("visitType")).branch(condition::equals("in-person"), "In person").branch(condition::equals("video"), "Video call").otherwise("").into()
}

pub fn your_details_summary() -> Value {
    govuk::SUMMARY_LIST.build(obj! {
        "card": obj! { "title": obj! { "text": "Your details" } },
        "rows": [
            obj! {
                "key": obj! { "text": "Full name" },
                "value": obj! { "text": answer("visitorName") },
                "actions": obj! {
                    "items": [
                        obj! {
                            "href": "your-details/your-name",
                            "text": "Change",
                            "visuallyHiddenText": "your name",
                        },
                    ],
                },
            },
            obj! {
                "key": obj! { "text": "Relationship" },
                "value": obj! { "text": relationship_label() },
                "actions": obj! {
                    "items": [
                        obj! {
                            "href": "your-details/relationship",
                            "text": "Change",
                            "visuallyHiddenText": "your relationship",
                        },
                    ],
                },
            },
        ],
    })
}

pub fn visit_preferences_summary() -> Value {
    govuk::SUMMARY_LIST.build(obj! {
        "card": obj! { "title": obj! { "text": "Visit preferences" } },
        "rows": [
            obj! {
                "key": obj! { "text": "Preferred day" },
                "value": obj! { "text": day_label() },
                "actions": obj! {
                    "items": [
                        obj! {
                            "href": "visit-preferences/preferred-day",
                            "text": "Change",
                            "visuallyHiddenText": "preferred day",
                        },
                    ],
                },
            },
            obj! {
                "key": obj! { "text": "Type of visit" },
                "value": obj! { "text": visit_type_label() },
                "actions": obj! {
                    "items": [
                        obj! {
                            "href": "visit-preferences/visit-type",
                            "text": "Change",
                            "visuallyHiddenText": "type of visit",
                        },
                    ],
                },
            },
        ],
    })
}

pub fn additional_needs_summary() -> Value {
    govuk::SUMMARY_LIST.build(obj! {
        "card": obj! { "title": obj! { "text": "Additional needs" } },
        "rows": [
            obj! {
                "key": obj! { "text": "Requirements" },
                "value": obj! { "text": answer("additionalNeeds") },
                "actions": obj! {
                    "items": [
                        obj! {
                            "href": "additional-needs",
                            "text": "Change",
                            "visuallyHiddenText": "additional needs",
                        },
                    ],
                },
            },
        ],
    })
}

pub fn confirm_body() -> Value {
    govuk::BODY.build(obj! {
        "text": "By submitting this application you confirm that the information you have provided is correct.",
    })
}

pub fn submit_button() -> Value {
    govuk::BUTTON.build(obj! { "text": "Submit application" })
}
