use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::blocks::{heading, intro, goal_actions, continue_button};

pub fn manage_plan_step() -> Value {
    step(obj! {
        "code": "manage-plan",
        "path": "/manage-plan",
        "title": "Add actions to goals",
        "reachability": obj! { "entryWhen": true },
        "blocks": [heading(), intro(), goal_actions(), continue_button()],
        "onAccess": [
            access(obj! {
                "effects": [effect::call("InitializePlanActions", vec![])],
            }),
        ],
        "onSubmission": [
            submit(obj! {
                "validate": false,
                "onAlways": obj! {
                    "effects": [effect::call("SavePlanActions", vec![])],
                    "next": [redirect(obj! { "goto": "agree-plan" })],
                },
            }),
        ],
    })
}
