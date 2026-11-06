use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::super::guards::require_auth;
use super::blocks::{heading, role_message, viewer_notice, summary_list, edit_heading, name_field, email_field, department_field, save_button, back_button};

const FIELD_CODES: [&str; 3] = ["recordName", "recordEmail", "recordDepartment"];

pub fn record_step() -> Value {
    step(obj! {
        "code": "record",
        "path": "/record/:index",
        "title": "Contact record",
        "reachability": obj! { "entryWhen": true },
        "onAccess": [
            require_auth(),
            access(obj! {
                "effects": [
                    effect::call("LoadItemForEdit", vec!["read-only-mode".into(), "contacts".into(), FIELD_CODES.into()]),
                ],
            }),
        ],
        "blocks": [
            heading(),
            role_message(),
            viewer_notice(),
            summary_list(),
            edit_heading(),
            name_field(),
            email_field(),
            department_field(),
            save_button(),
            back_button(),
        ],
        "onSubmission": [
            submit(obj! {
                "validate": true,
                "onValid": obj! {
                    "effects": [
                        effect::call("EditItemInCollection", vec!["read-only-mode".into(), "contacts".into(), FIELD_CODES.into()]),
                        effect::call("SaveDraftAnswers", vec!["read-only-mode".into()]),
                    ],
                    "next": [redirect(obj! { "goto": "../contacts" })],
                },
            }),
        ],
    })
}
