use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::blocks::{role_field, continue_button};

pub fn your_role_step() -> Value {
    step(obj! {
        "code": "your-role",
        "path": "/your-role",
        "title": "What is your role?",
        "blocks": [role_field(), continue_button()],
        "onSubmission": [
            submit(obj! {
                "validate": true,
                "onValid": obj! {
                    "effects": [effect::call("SaveDraftAnswers", vec!["resuming".into()])],
                    // Last question — proceed to the summary page
                    "next": [redirect(obj! { "goto": "check-answers" })],
                },
            }),
        ],
    })
}
