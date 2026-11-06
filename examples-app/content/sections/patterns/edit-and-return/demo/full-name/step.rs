use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::blocks::{full_name_field, continue_button};

pub fn full_name_step() -> Value {
    step(obj! {
        "code": "full-name",
        "path": "/full-name",
        "title": "What is your full name?",
        "reachability": obj! { "entryWhen": true },
        "blocks": [full_name_field(), continue_button()],
        "onSubmission": [
            submit(obj! {
                "validate": true,
                "onValid": obj! {
                    "effects": [effect::call("SaveDraftAnswers", vec!["edit-and-return".into()])],
                    "next": [
                        // When the user arrived via a change link, return to the summary
                        redirect(obj! {
                            "when": query("returnTo").matches(condition::equals("check-answers")),
                            "goto": "check-answers",
                        }),
                        redirect(obj! { "goto": "email-address" }),
                    ],
                },
            }),
        ],
    })
}
