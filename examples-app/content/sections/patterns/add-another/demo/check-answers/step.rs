use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::blocks::{heading, contact_summary_cards, confirm_body, submit_button};

pub fn check_answers_step() -> Value {
    step(obj! {
        "code": "check-answers",
        "path": "/check-answers",
        "title": "Check your answers",
        "blocks": [heading(), contact_summary_cards(), confirm_body(), submit_button()],
        "onSubmission": [
            submit(obj! {
                "validate": false,
                "onAlways": obj! {
                    // Persist answers permanently, mark submitted in session, then clear drafts
                    "effects": [
                        effect::call("SaveAnswers", vec!["add-another".into()]),
                        effect::call("SaveSubmitStateToSession", vec!["add-another".into(), true.into()]),
                        effect::call("ClearDraftAnswers", vec!["add-another".into()]),
                    ],
                    "next": [
                        redirect(obj! {
                            "when": session("patternSubmitted.add-another").matches(condition::equals(true)),
                            "goto": "confirmation",
                        }),
                    ],
                },
            }),
        ],
    })
}
