use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::blocks::{heading, contact_summary, buttons};

const CONTACT_FIELD_CODES: [&str; 3] = ["contactName", "contactRelationship", "contactPhone"];

pub fn delete_contact_step() -> Value {
    step(obj! {
        "code": "delete-contact",
        "path": "/delete-contact/:index",
        "title": "Remove emergency contact",
        "reachability": obj! { "entryWhen": true },
        "blocks": [heading(), contact_summary(), buttons()],
        "onAccess": [
            access(obj! {
                "effects": [effect::call("LoadItemForDelete", vec!["contacts".into(), CONTACT_FIELD_CODES.into()])],
            }),
        ],
        "onSubmission": [
            submit(obj! {
                "when": post("action").matches(condition::equals("confirm")),
                "validate": false,
                "onAlways": obj! {
                    "effects": [
                        effect::call("DeleteItemFromCollection", vec!["contacts".into()]),
                        effect::call("SaveDraftAnswers", vec!["add-another".into()]),
                    ],
                    "next": [redirect(obj! { "goto": "your-contacts" })],
                },
            }),
            submit(obj! {
                "when": post("action").matches(condition::equals("cancel")),
                "validate": false,
                "onAlways": obj! {
                    "next": [redirect(obj! { "goto": "your-contacts" })],
                },
            }),
        ],
    })
}
