use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::blocks::{heard_from_field, continue_button};

pub fn heard_from_step() -> Value {
    step(obj! {
        "code": "heard-from",
        "path": "/heard-from",
        "title": "How did you hear about us?",
        "reachability": obj! { "entryWhen": true },
        "blocks": [heard_from_field(), continue_button()],
        "onSubmission": [
            submit(obj! {
                "validate": true,
                "onValid": obj! {
                    "effects": [effect::call("SaveDraftAnswers", vec!["reveal-fields".into()])],
                    "next": [redirect(obj! { "goto": "check-answers" })],
                },
            }),
        ],
    })
}
