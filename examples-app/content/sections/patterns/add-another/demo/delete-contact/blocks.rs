use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

fn relationship_label(relationship: Ex) -> Value {
    match_(relationship)
        .branch(condition::equals("partner"), "Partner")
        .branch(condition::equals("parent"), "Parent")
        .branch(condition::equals("sibling"), "Sibling")
        .branch(condition::equals("child"), "Child")
        .branch(condition::equals("friend"), "Friend")
        .branch(condition::equals("colleague"), "Colleague")
        .branch(condition::equals("other"), "Other")
        .otherwise("")
        .into()
}

pub fn heading() -> Value {
    govuk::HEADING.build(obj! {
        "text": "Are you sure you want to remove this contact?",
        "size": "l",
    })
}

pub fn contact_summary() -> Value {
    govuk::SUMMARY_LIST.build(obj! {
        "rows": [
            obj! {
                "key": obj! { "text": "Name" },
                "value": obj! { "text": data("contactName") },
            },
            obj! {
                "key": obj! { "text": "Relationship" },
                "value": obj! { "text": relationship_label(data("contactRelationship")) },
            },
            obj! {
                "key": obj! { "text": "Phone number" },
                "value": obj! { "text": data("contactPhone") },
            },
        ],
    })
}

pub fn buttons() -> Value {
    govuk::BUTTON_GROUP.build(obj! {
        "buttons": [
            govuk::BUTTON.build(obj! {
                "text": "Remove contact",
                "classes": "govuk-button--warning",
                "name": "action",
                "value": "confirm",
            }),
            govuk::BUTTON.build(obj! {
                "text": "Cancel",
                "classes": "govuk-button--secondary",
                "name": "action",
                "value": "cancel",
            }),
        ],
    })
}
