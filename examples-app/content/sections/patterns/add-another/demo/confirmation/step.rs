use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::blocks::{panel, next_steps, restart_button};

pub fn confirmation_step() -> Value {
    step(obj! {
        "code": "confirmation",
        "path": "/confirmation",
        "title": "Emergency contacts saved",
        "reachability": obj! {
            // Session-based entry — survives ClearDraftAnswers unlike answer-based conditions
            "entryWhen": session("patternSubmitted.add-another").matches(condition::equals(true)),
            // Priority 200 wins over the overview entry point
            "tieBreakers": [tie_breaker(obj! { "priority": 200 })],
        },
        "blocks": [panel(), next_steps(), restart_button()],
        "onSubmission": [
            submit(obj! {
                "validate": false,
                "onAlways": obj! {
                    // Reset everything so the user can start fresh
                    "effects": [
                        effect::call("ClearAnswers", vec!["add-another".into()]),
                        effect::call("ClearDraftAnswers", vec!["add-another".into()]),
                        effect::call("SaveSubmitStateToSession", vec!["add-another".into(), false.into()]),
                    ],
                    "next": [redirect(obj! { "goto": "overview" })],
                },
            }),
        ],
    })
}
