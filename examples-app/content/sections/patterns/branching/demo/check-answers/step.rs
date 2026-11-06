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
                        // Persist answers permanently, mark submitted in session, then clear drafts
                        effect::call("SaveAnswers", vec!["branching".into()]),
                        effect::call("SaveSubmitStateToSession", vec!["branching".into(), true.into()]),
                        effect::call("ClearDraftAnswers", vec!["branching".into()]),
                    ],
                    "next": [
                        redirect(obj! {
                            // Gate on session state so the redirect only fires after the effects
                            // above have run — the session value survives ClearDraftAnswers.
                            "when": session("patternSubmitted.branching").matches(condition::equals(true)),
                            "goto": "confirmation",
                        }),
                    ],
                },
            }),
        ],
    })
}
