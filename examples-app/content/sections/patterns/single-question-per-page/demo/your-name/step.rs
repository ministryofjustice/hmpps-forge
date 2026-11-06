use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::blocks::{full_name_field, continue_button};

// Each question page validates on submit, saves the answer into the session,
// and redirects to the next question. Because the journey loads answers on
// access, returning users see their previous input already filled in.
pub fn your_name_step() -> Value {
    step(obj! {
        "code": "your-name",
        "path": "/your-name",
        "title": "What is your name?",
        "reachability": obj! { "entryWhen": true },
        "blocks": [full_name_field(), continue_button()],
        "onSubmission": [
            submit(obj! {
                "validate": true,
                "onValid": obj! {
                    "effects": [effect::call("SaveDraftAnswers", vec!["single-question-per-page".into()])],
                    "next": [redirect(obj! { "goto": "your-role" })],
                },
            }),
        ],
    })
}
