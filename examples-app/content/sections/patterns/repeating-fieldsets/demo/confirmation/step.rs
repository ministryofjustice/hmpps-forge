use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::blocks::{panel, next_steps, restart_button};

const PATTERN_CODE: &str = "repeating-fieldsets";

pub fn confirmation_step() -> Value {
    step(obj! {
        "code": "confirmation",
        "path": "/confirmation",
        "title": "Household saved",
        "reachability": obj! {
            "entryWhen": session(&format!("patternSubmitted.{PATTERN_CODE}")).matches(condition::equals(true)),
            "tieBreakers": [tie_breaker(obj! { "priority": 200 })],
        },
        "blocks": [panel(), next_steps(), restart_button()],
        "onSubmission": [
            submit(obj! {
                "validate": false,
                "onAlways": obj! {
                    "effects": [
                        effect::call("ClearAnswers", vec![PATTERN_CODE.into()]),
                        effect::call("ClearDraftAnswers", vec![PATTERN_CODE.into()]),
                        effect::call("SaveSubmitStateToSession", vec![PATTERN_CODE.into(), false.into()]),
                    ],
                    "next": [redirect(obj! { "goto": "overview" })],
                },
            }),
        ],
    })
}
