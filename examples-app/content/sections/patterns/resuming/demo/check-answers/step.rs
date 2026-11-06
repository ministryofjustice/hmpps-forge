use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::blocks::{heading, summary_list, confirm_body, submit_button};

// The redirect is gated on the Confirm button being posted. On a GET — which is
// what the journey-root resume walk performs — there is no POST body, so the
// condition fails and the forward edge does not resolve. That keeps the walk
// from stepping past `check-answers` into `confirmation` for a user who has
// filled in every answer but not yet submitted.
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
                        effect::call("SaveAnswers", vec!["resuming".into()]),
                        effect::call("SaveSubmitStateToSession", vec!["resuming".into(), true.into()]),
                        effect::call("ClearDraftAnswers", vec!["resuming".into()]),
                    ],
                    "next": [
                        redirect(obj! {
                            "when": session("patternSubmitted.resuming").matches(condition::equals(true)),
                            "goto": "confirmation",
                        }),
                    ],
                },
            }),
        ],
    })
}
