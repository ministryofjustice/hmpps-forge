use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::blocks::{heading, relationship_field, continue_button};

pub fn relationship_step() -> Value {
    step(obj! {
        "code": "relationship",
        "path": "/relationship",
        "title": "Relationship",
        "blocks": [heading(), relationship_field(), continue_button()],
        "onSubmission": [
            submit(obj! {
                "validate": true,
                "onValid": obj! {
                    "effects": [
                        // Mark section as complete
                        effect::call("SetAnswer", vec!["yourDetailsStatus".into(), "completed".into()]),
                        effect::call("SaveDraftAnswers", vec!["task-list".into()]),
                    ],
                    // Return to task list hub in the parent journey
                    "next": [redirect(obj! { "goto": "../tasks" })],
                },
            }),
        ],
    })
}
