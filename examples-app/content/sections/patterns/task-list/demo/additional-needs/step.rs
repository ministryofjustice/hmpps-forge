use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::blocks::{heading, hint, additional_needs_field, continue_button};

// Only reachable once both preceding sections are complete
pub fn prerequisites_met() -> Value {
    and(vec![answer("yourDetailsStatus").matches(condition::equals("completed")), answer("visitPreferencesStatus").matches(condition::equals("completed"))]).into()
}

pub fn additional_needs_step() -> Value {
    step(obj! {
        "code": "additional-needs",
        "path": "/additional-needs",
        "title": "Additional needs",
        // Gated entry — blocks direct URL access until prerequisites are met
        "reachability": obj! { "entryWhen": prerequisites_met() },
        "backlink": "tasks",
        "blocks": [heading(), hint(), additional_needs_field(), continue_button()],
        "onSubmission": [
            submit(obj! {
                "validate": true,
                "onValid": obj! {
                    "effects": [
                        // Single-step section — goes straight to completed
                        effect::call("SetAnswer", vec!["additionalNeedsStatus".into(), "completed".into()]),
                        effect::call("SaveDraftAnswers", vec!["task-list".into()]),
                    ],
                    // Return to task list hub
                    "next": [redirect(obj! { "goto": "tasks" })],
                },
            }),
        ],
    })
}
