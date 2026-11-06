use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;
use forge_govuk_components::classes;

pub fn heading() -> Value {
    govuk::HEADING.build(obj! {
        "text": "What is your relationship to the prisoner?",
        "size": "l",
    })
}

pub fn relationship_field() -> Value {
    govuk::SELECT_INPUT.build(obj! {
        "code": "relationship",
        "label": obj! {
            "text": "Relationship",
            "classes": classes::label::MEDIUM,
        },
        "items": [
            obj! { "value": "", "text": "Choose a relationship" },
            obj! { "value": "partner", "text": "Partner or spouse" },
            obj! { "value": "parent", "text": "Parent" },
            obj! { "value": "child", "text": "Son or daughter" },
            obj! { "value": "sibling", "text": "Brother or sister" },
            obj! { "value": "friend", "text": "Friend" },
            obj! { "value": "legal", "text": "Legal representative" },
            obj! { "value": "other", "text": "Other" },
        ],
        "validWhen": [
            validation(obj! {
                "condition": self_().matches(condition::is_required()),
                "message": "Select your relationship to the prisoner",
                "submissionOnly": true,
            }),
        ],
    })
}

pub fn continue_button() -> Value {
    govuk::BUTTON.build(obj! { "text": "Save and return" })
}
