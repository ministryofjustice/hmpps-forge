use forge_core::authoring::*;
use forge_core::builtins::components as core_blocks;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

pub fn heading() -> Value {
    govuk::HEADING.build(obj! {
        "text": "Your emergency contacts",
        "size": "l",
    })
}

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

pub fn contact_cards() -> Value {
    core_blocks::COLLECTION_BLOCK.build(obj! {
        "collection": answer("contacts").each(iterator::map(govuk::SUMMARY_LIST.build(obj! {
            "card": obj! {
                "title": obj! { "text": item().path("contactName") },
                "actions": obj! {
                    "items": [
                        obj! {
                            "href": format("edit-contact/%1", [Loop.index0().into()]),
                            "text": "Change",
                            "visuallyHiddenText": item().path("contactName"),
                        },
                        obj! {
                            "href": format("delete-contact/%1", [Loop.index0().into()]),
                            "text": "Remove",
                            "visuallyHiddenText": item().path("contactName"),
                        },
                    ],
                },
            },
            "rows": [
                obj! {
                    "key": obj! { "text": "Relationship" },
                    "value": obj! { "text": relationship_label(item().path("contactRelationship")) },
                },
                obj! {
                    "key": obj! { "text": "Phone number" },
                    "value": obj! { "text": item().path("contactPhone") },
                },
            ],
        }))),
        "fallback": [govuk::INSET_TEXT.build(obj! { "text": "You have not added any emergency contacts yet." })],
    })
}

pub fn button_group() -> Value {
    govuk::BUTTON_GROUP.build(obj! {
        "buttons": [
            govuk::BUTTON.build(obj! {
                "text": "Add another contact",
                "classes": "govuk-button--secondary",
                "name": "action",
                "value": "add-another",
            }),
            govuk::BUTTON.build(obj! {
                "text": "Continue",
                "name": "action",
                "value": "continue",
            }),
        ],
    })
}
