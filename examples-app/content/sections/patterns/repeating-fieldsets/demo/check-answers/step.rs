use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::blocks::{heading, member_summaries, change_link, confirm_body, submit_button};

const PATTERN_CODE: &str = "repeating-fieldsets";

const COLLECTION_CODE: &str = "members";

const FIELD_CODES: [&str; 2] = ["memberName", "memberAge"];

pub fn check_answers_step() -> Value {
    step(obj! {
        "code": "check-answers",
        "path": "/check-answers",
        "title": "Check your answers",
        "blocks": [heading(), member_summaries(), change_link(), confirm_body(), submit_button()],
        "onAccess": [
            access(obj! {
                "effects": [
                    effect::call("InitializeRepeatingFieldsets", vec![PATTERN_CODE.into(), COLLECTION_CODE.into(), FIELD_CODES.into()]),
                ],
            }),
        ],
        "onSubmission": [
            submit(obj! {
                "validate": false,
                "onAlways": obj! {
                    "effects": [
                        effect::call("SaveAnswers", vec![PATTERN_CODE.into()]),
                        effect::call("SaveSubmitStateToSession", vec![PATTERN_CODE.into(), true.into()]),
                    ],
                    "next": [
                        redirect(obj! {
                            "when": session(&format!("patternSubmitted.{PATTERN_CODE}")).matches(condition::equals(true)),
                            "goto": "confirmation",
                        }),
                    ],
                },
            }),
        ],
    })
}
