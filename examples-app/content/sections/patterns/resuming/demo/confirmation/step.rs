use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::blocks::{panel, next_steps, restart_button};

pub fn confirmation_step() -> Value {
    step(obj! {
        "code": "confirmation",
        "path": "/confirmation",
        "title": "Answers submitted",
        "reachability": obj! {
            // Session-based entry — survives ClearDraftAnswers unlike answer-based conditions
            "entryWhen": session("patternSubmitted.resuming").matches(condition::equals(true)),
            // Priority 200 wins over overview (100), so a submitted user lands here
            // instead of being sent back to the overview page.
            "tieBreakers": [tie_breaker(obj! { "priority": 200 })],
        },
        "blocks": [panel(), next_steps(), restart_button()],
        "onSubmission": [
            submit(obj! {
                "validate": false,
                "onAlways": obj! {
                    // Reset everything so the user can start fresh
                    "effects": [
                        effect::call("ClearAnswers", vec!["resuming".into()]),
                        effect::call("ClearDraftAnswers", vec!["resuming".into()]),
                        effect::call("SaveSubmitStateToSession", vec!["resuming".into(), false.into()]),
                    ],
                    "next": [redirect(obj! { "goto": "overview" })],
                },
            }),
        ],
    })
}
