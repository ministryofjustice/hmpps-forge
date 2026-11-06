use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::blocks::{full_name_field, continue_button};

pub fn your_name_step() -> Value {
    step(obj! {
        "code": "your-name",
        "path": "/your-name",
        "title": "What is your name?",
        // Entry point that the resume walk evaluates from — when the user has
        // answered this step, resume skips past it to the next unanswered step.
        "reachability": obj! { "entryWhen": true },
        "blocks": [full_name_field(), continue_button()],
        "onSubmission": [
            submit(obj! {
                "validate": true,
                "onValid": obj! {
                    // Persist progress so the user can leave and resume later
                    "effects": [effect::call("SaveDraftAnswers", vec!["resuming".into()])],
                    "next": [redirect(obj! { "goto": "your-role" })],
                },
            }),
        ],
    })
}
