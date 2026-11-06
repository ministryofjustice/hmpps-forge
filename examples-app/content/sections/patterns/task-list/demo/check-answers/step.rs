use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::blocks::{heading, your_details_summary, visit_preferences_summary, additional_needs_summary, confirm_body, submit_button};

// Only reachable once every section is complete
pub fn all_complete() -> Value {
    and(vec![answer("yourDetailsStatus").matches(condition::equals("completed")), answer("visitPreferencesStatus").matches(condition::equals("completed")), answer("additionalNeedsStatus").matches(condition::equals("completed"))]).into()
}

pub fn check_answers_step() -> Value {
    step(obj! {
        "code": "check-answers",
        "path": "/check-answers",
        "title": "Check your answers",
        // Gated entry — all sections must be done before the user can review
        "reachability": obj! { "entryWhen": all_complete() },
        "backlink": "tasks",
        "blocks": [
            heading(),
            your_details_summary(),
            visit_preferences_summary(),
            additional_needs_summary(),
            confirm_body(),
            submit_button(),
        ],
        "onSubmission": [
            submit(obj! {
                "validate": false,
                "onAlways": obj! {
                    "effects": [
                        // Persist answers permanently, mark submitted in session, then clear drafts
                        effect::call("SaveAnswers", vec!["task-list".into()]),
                        effect::call("SaveSubmitStateToSession", vec!["task-list".into(), true.into()]),
                        effect::call("ClearDraftAnswers", vec!["task-list".into()]),
                    ],
                    "next": [
                        redirect(obj! {
                            "when": session("patternSubmitted.task-list").matches(condition::equals(true)),
                            "goto": "confirmation",
                        }),
                    ],
                },
            }),
        ],
    })
}
