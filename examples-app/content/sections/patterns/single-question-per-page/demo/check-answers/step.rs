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
                        effect::call("SaveAnswers", vec!["single-question-per-page".into()]),
                        effect::call("SaveSubmitStateToSession", vec!["single-question-per-page".into(), true.into()]),
                        effect::call("ClearDraftAnswers", vec!["single-question-per-page".into()]),
                    ],
                    "next": [
                        redirect(obj! {
                            "when": session("patternSubmitted.single-question-per-page").matches(condition::equals(true)),
                            "goto": "confirmation",
                        }),
                    ],
                },
            }),
        ],
    })
}
