use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::blocks::{location_field, continue_button};

// Branch step for the in-person path. Only reachable when visitType is
// 'in-person', because that is the only case where visit-type's submit hook
// redirects here. Forge's reachability keeps users off this step via the URL
// if their earlier answer was different.
pub fn location_step() -> Value {
    step(obj! {
        "code": "location",
        "path": "/location",
        "title": "Which office would you like to visit?",
        "blocks": [location_field(), continue_button()],
        "onSubmission": [
            submit(obj! {
                "validate": true,
                "onValid": obj! {
                    "effects": [effect::call("SaveDraftAnswers", vec!["branching".into()])],
                    "next": [redirect(obj! { "goto": "check-answers" })],
                },
            }),
        ],
    })
}
