use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::blocks::{heading, name_field, continue_button};

pub fn your_name_step() -> Value {
    step(obj! {
        "code": "your-name",
        "path": "/your-name",
        "title": "Your name",
        // Entry point for this child journey — linked from the task list hub
        "reachability": obj! { "entryWhen": true },
        // Override backlink to point to the task list hub in the parent journey
        "backlink": "../tasks",
        "blocks": [heading(), name_field(), continue_button()],
        "onSubmission": [
            submit(obj! {
                "validate": true,
                "onValid": obj! {
                    "effects": [
                        // Mark section as started
                        effect::call("SetAnswer", vec!["yourDetailsStatus".into(), "in-progress".into()]),
                        effect::call("SaveDraftAnswers", vec!["task-list".into()]),
                    ],
                    // Next step within this child journey
                    "next": [redirect(obj! { "goto": "relationship" })],
                },
            }),
        ],
    })
}
