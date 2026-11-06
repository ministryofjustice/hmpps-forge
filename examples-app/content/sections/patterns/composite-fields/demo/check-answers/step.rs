use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::blocks::{heading, summary_list, confirm_body, submit_button};

pub fn check_answers_step() -> Value {
    step(obj! {
        "code": "check-answers",
        "path": "/check-answers",
        "title": "Check your answers",
        "blocks": [heading(), summary_list(), confirm_body(), submit_button()],
        "onSubmission": [
            submit(obj! {
                "validate": false,
                "onAlways": obj! {
                    "effects": [
                        effect::call("SaveAnswers", vec!["composite-fields".into()]),
                        effect::call("SaveSubmitStateToSession", vec!["composite-fields".into(), true.into()]),
                        effect::call("ClearDraftAnswers", vec!["composite-fields".into()]),
                    ],
                    "next": [
                        redirect(obj! {
                            "when": session("patternSubmitted.composite-fields").matches(condition::equals(true)),
                            "goto": "confirmation",
                        }),
                    ],
                },
            }),
        ],
    })
}
