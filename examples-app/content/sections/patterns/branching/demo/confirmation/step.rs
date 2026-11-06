use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::blocks::{panel, next_steps, restart_button};

pub fn confirmation_step() -> Value {
    step(obj! {
        "code": "confirmation",
        "path": "/confirmation",
        "title": "Visit booked",
        "reachability": obj! {
            // Session-based entry — survives ClearDraftAnswers unlike answer-based conditions
            "entryWhen": session("patternSubmitted.branching").matches(condition::equals(true)),
            // Priority 200 wins over the overview entry point, so a submitted user
            // lands here instead of being sent back to the start.
            "tieBreakers": [tie_breaker(obj! { "priority": 200 })],
        },
        "blocks": [panel(), next_steps(), restart_button()],
        "onSubmission": [
            submit(obj! {
                "validate": false,
                "onAlways": obj! {
                    // Reset everything so the user can try a different branch
                    "effects": [
                        effect::call("ClearAnswers", vec!["branching".into()]),
                        effect::call("ClearDraftAnswers", vec!["branching".into()]),
                        effect::call("SaveSubmitStateToSession", vec!["branching".into(), false.into()]),
                    ],
                    "next": [redirect(obj! { "goto": "overview" })],
                },
            }),
        ],
    })
}
