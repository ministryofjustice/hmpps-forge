use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::blocks::{heading, name_field, relationship_field, phone_field, continue_button};

const CONTACT_FIELD_CODES: [&str; 3] = ["contactName", "contactRelationship", "contactPhone"];

pub fn edit_contact_step() -> Value {
    step(obj! {
        "code": "edit-contact",
        // :index is extracted from the URL automatically by Forge
        "path": "/edit-contact/:index",
        "title": "Change emergency contact",
        "reachability": obj! { "entryWhen": true },
        "blocks": [heading(), name_field(), relationship_field(), phone_field(), continue_button()],
        // Pre-fill the form fields from the existing item at the given index
        "onAccess": [
            access(obj! {
                "effects": [
                    effect::call("LoadItemForEdit", vec!["add-another".into(), "contacts".into(), CONTACT_FIELD_CODES.into()]),
                ],
            }),
        ],
        "onSubmission": [
            submit(obj! {
                "validate": true,
                "onValid": obj! {
                    "effects": [
                        // Replaces the item at the stored index rather than appending
                        effect::call("EditItemInCollection", vec!["add-another".into(), "contacts".into(), CONTACT_FIELD_CODES.into()]),
                        effect::call("SaveDraftAnswers", vec!["add-another".into()]),
                    ],
                    "next": [redirect(obj! { "goto": "your-contacts" })],
                },
            }),
        ],
    })
}
