use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::blocks::{heading, intro, shows, shows_list, resume_panel, continue_button, start_button, scenarios_heading, seed_partial_button, seed_complete_button, clear_button};

pub fn overview_step() -> Value {
    step(obj! {
        "path": "/overview",
        "title": "Resuming a partially-completed journey",
        "reachability": obj! {
            "entryWhen": true,
            // Priority 100 ensures this page wins as the default landing page over
            // your-name (which is also an entry point for resume to evaluate from).
            "tieBreakers": [tie_breaker(obj! { "priority": 100 })],
        },
        "metadata": obj! { "hiddenFromNav": true },
        "blocks": [
            heading(),
            intro(),
            shows(),
            shows_list(),
            resume_panel(),
            continue_button(),
            start_button(),
            scenarios_heading(),
            seed_partial_button(),
            seed_complete_button(),
            clear_button(),
        ],
        // Demo aid: seed or clear saved answers so you can try different resume
        // states without filling in every form. Each button posts an action value
        // that triggers the matching handler below.
        "onSubmission": [
            submit(obj! {
                "when": post("action").matches(condition::equals("seed-partial")),
                "validate": false,
                "onAlways": obj! {
                    "effects": [effect::call("SeedDraftAnswers", vec!["resuming".into(), obj! { "fullName": "Ada Lovelace" }])],
                },
            }),
            submit(obj! {
                "when": post("action").matches(condition::equals("seed-complete")),
                "validate": false,
                "onAlways": obj! {
                    "effects": [
                        effect::call("SeedDraftAnswers", vec!["resuming".into(), obj! {
                            "fullName": "Ada Lovelace",
                            "role": "Developer",
                        }]),
                    ],
                },
            }),
            submit(obj! {
                "when": post("action").matches(condition::equals("clear")),
                "validate": false,
                "onAlways": obj! {
                    "effects": [
                        effect::call("ClearAnswers", vec!["resuming".into()]),
                        effect::call("ClearDraftAnswers", vec!["resuming".into()]),
                    ],
                },
            }),
        ],
    })
}
