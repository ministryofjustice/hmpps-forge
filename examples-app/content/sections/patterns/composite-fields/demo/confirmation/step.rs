use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::blocks::{panel, next_steps, restart_button};

pub fn confirmation_step() -> Value {
    step(obj! {
        "code": "confirmation",
        "path": "/confirmation",
        "title": "Details saved",
        "reachability": obj! {
            "entryWhen": session("patternSubmitted.composite-fields").matches(condition::equals(true)),
            "tieBreakers": [tie_breaker(obj! { "priority": 200 })],
        },
        "blocks": [panel(), next_steps(), restart_button()],
        "onSubmission": [
            submit(obj! {
                "validate": false,
                "onAlways": obj! {
                    "effects": [
                        effect::call("ClearAnswers", vec!["composite-fields".into()]),
                        effect::call("ClearDraftAnswers", vec!["composite-fields".into()]),
                        effect::call("SaveSubmitStateToSession", vec!["composite-fields".into(), false.into()]),
                    ],
                    "next": [redirect(obj! { "goto": "overview" })],
                },
            }),
        ],
    })
}
