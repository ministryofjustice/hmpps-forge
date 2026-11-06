use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::blocks::{panel, what_next, restart_button};

pub fn confirmation_step() -> Value {
    step(obj! {
        "code": "confirmation",
        "path": "/confirmation",
        "title": "Application submitted",
        "reachability": obj! {
            // Session-based entry — survives ClearDraftAnswers unlike answer-based conditions
            "entryWhen": session("patternSubmitted.task-list").matches(condition::equals(true)),
            // Win over the tasks entrypoint, so that if user opens journey again (but hasnt reset),
            // they are taken straight to the confirmation page.
            "tieBreakers": [tie_breaker(obj! { "priority": 100 })],
        },
        "blocks": [panel(), what_next(), restart_button()],
        "onSubmission": [
            submit(obj! {
                "when": post("action").matches(condition::equals("restart")),
                "validate": false,
                "onAlways": obj! {
                    "effects": [
                        // Reset everything so the user can start fresh
                        effect::call("ClearAnswers", vec!["task-list".into()]),
                        effect::call("ClearDraftAnswers", vec!["task-list".into()]),
                        effect::call("SaveSubmitStateToSession", vec!["task-list".into(), false.into()]),
                    ],
                    "next": [redirect(obj! { "goto": "overview" })],
                },
            }),
        ],
    })
}
