use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::blocks::{heading, visit_type_field, continue_button};

pub fn visit_type_step() -> Value {
    step(obj! {
        "code": "visit-type",
        "path": "/visit-type",
        "title": "Visit type",
        "blocks": [heading(), visit_type_field(), continue_button()],
        "onSubmission": [
            submit(obj! {
                "validate": true,
                "onValid": obj! {
                    "effects": [
                        // Mark section as complete
                        effect::call("SetAnswer", vec!["visitPreferencesStatus".into(), "completed".into()]),
                        effect::call("SaveDraftAnswers", vec!["task-list".into()]),
                    ],
                    // Return to task list hub in the parent journey
                    "next": [redirect(obj! { "goto": "../tasks" })],
                },
            }),
        ],
    })
}
