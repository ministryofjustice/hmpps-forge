use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;
use forge_govuk_components::classes;

pub fn heading() -> Value {
    govuk::HEADING.build(obj! {
        "text": "Add an emergency contact",
        "size": "l",
    })
}

pub fn name_field() -> Value {
    govuk::TEXT_INPUT.build(obj! {
        "code": "contactName",
        "label": obj! {
            "text": "Full name",
            "classes": classes::label::MEDIUM,
        },
        "validWhen": [
            validation(obj! {
                "condition": self_().matches(condition::is_required()),
                "message": "Enter a full name",
                "submissionOnly": true,
            }),
        ],
    })
}

pub fn relationship_field() -> Value {
    govuk::SELECT_INPUT.build(obj! {
        "code": "contactRelationship",
        "label": obj! {
            "text": "Relationship",
            "classes": classes::label::MEDIUM,
        },
        "items": [
            obj! { "value": "", "text": "Choose a relationship" },
            obj! { "value": "partner", "text": "Partner" },
            obj! { "value": "parent", "text": "Parent" },
            obj! { "value": "sibling", "text": "Sibling" },
            obj! { "value": "child", "text": "Child" },
            obj! { "value": "friend", "text": "Friend" },
            obj! { "value": "colleague", "text": "Colleague" },
            obj! { "value": "other", "text": "Other" },
        ],
        "validWhen": [
            validation(obj! {
                "condition": self_().matches(condition::is_required()),
                "message": "Select a relationship",
                "submissionOnly": true,
            }),
        ],
    })
}

pub fn phone_field() -> Value {
    govuk::TEXT_INPUT.build(obj! {
        "code": "contactPhone",
        "label": obj! {
            "text": "Phone number",
            "classes": classes::label::MEDIUM,
        },
        "validWhen": [
            validation(obj! {
                "condition": self_().matches(condition::is_required()),
                "message": "Enter a phone number",
                "submissionOnly": true,
            }),
        ],
    })
}

pub fn continue_button() -> Value {
    govuk::BUTTON.build(obj! { "text": "Save and continue" })
}
