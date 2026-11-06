use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::blocks::{phone_number_field, continue_button};

// Branch step for the phone path — only reachable when visitType is 'phone'.
// All branches converge on check-answers after collecting their details.
pub fn phone_number_step() -> Value {
    step(obj! {
        "code": "phone-number",
        "path": "/phone-number",
        "title": "What number should we call you on?",
        "blocks": [phone_number_field(), continue_button()],
        "onSubmission": [
            submit(obj! {
                "validate": true,
                "onValid": obj! {
                    "effects": [effect::call("SaveDraftAnswers", vec!["branching".into()])],
                    "next": [redirect(obj! { "goto": "check-answers" })],
                },
            }),
        ],
    })
}
