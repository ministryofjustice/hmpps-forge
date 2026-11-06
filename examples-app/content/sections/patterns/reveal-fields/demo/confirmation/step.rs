use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::blocks::{panel, next_steps, restart_button};

pub fn confirmation_step() -> Value {
    step(obj! {
        "code": "confirmation",
        "path": "/confirmation",
        "title": "Thanks for letting us know",
        "reachability": obj! {
            "entryWhen": session("patternSubmitted.reveal-fields").matches(condition::equals(true)),
            "tieBreakers": [tie_breaker(obj! { "priority": 200 })],
        },
        "blocks": [panel(), next_steps(), restart_button()],
        "onSubmission": [
            submit(obj! {
                "validate": false,
                "onAlways": obj! {
                    "effects": [
                        effect::call("ClearAnswers", vec!["reveal-fields".into()]),
                        effect::call("ClearDraftAnswers", vec!["reveal-fields".into()]),
                        effect::call("SaveSubmitStateToSession", vec!["reveal-fields".into(), false.into()]),
                    ],
                    "next": [redirect(obj! { "goto": "overview" })],
                },
            }),
        ],
    })
}
