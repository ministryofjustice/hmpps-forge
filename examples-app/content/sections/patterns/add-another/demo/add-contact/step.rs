use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::blocks::{heading, name_field, relationship_field, phone_field, continue_button};

// The fields bundled into each collection item
const CONTACT_FIELD_CODES: [&str; 3] = ["contactName", "contactRelationship", "contactPhone"];

pub fn add_contact_step() -> Value {
    step(obj! {
        "code": "add-contact",
        "path": "/add-contact",
        "title": "Add an emergency contact",
        // Entry point so this page stays reachable even when the list page's
        // validWhen rule fails (empty collection blocks forward propagation).
        "reachability": obj! { "entryWhen": true },
        "blocks": [heading(), name_field(), relationship_field(), phone_field(), continue_button()],
        "onSubmission": [
            submit(obj! {
                "validate": true,
                "onValid": obj! {
                    "effects": [
                        // Bundles the temporary field answers into an object and appends
                        // it to the contacts array, then clears the fields for next time.
                        effect::call("AddItemToCollection", vec!["contacts".into(), CONTACT_FIELD_CODES.into()]),
                        effect::call("SaveDraftAnswers", vec!["add-another".into()]),
                    ],
                    "next": [redirect(obj! { "goto": "your-contacts" })],
                },
            }),
        ],
    })
}
