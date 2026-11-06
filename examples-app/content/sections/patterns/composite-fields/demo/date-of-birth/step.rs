use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::blocks::{date_of_birth_field, continue_button};

pub fn date_of_birth_step() -> Value {
    step(obj! {
        "code": "date-of-birth",
        "path": "/date-of-birth",
        "title": "What is your date of birth?",
        "reachability": obj! {
            "entryWhen": true,
            "tieBreakers": [tie_breaker(obj! { "priority": 100 })],
        },
        "blocks": [date_of_birth_field(), continue_button()],
        "onSubmission": [
            submit(obj! {
                "validate": true,
                "onValid": obj! {
                    "effects": [effect::call("SaveDraftAnswers", vec!["composite-fields".into()])],
                    "next": [redirect(obj! { "goto": "address" })],
                },
            }),
        ],
    })
}
