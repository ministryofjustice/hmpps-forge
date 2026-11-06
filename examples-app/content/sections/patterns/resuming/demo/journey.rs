use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::overview::step::overview_step;
use super::your_name::step::your_name_step;
use super::your_role::step::your_role_step;
use super::check_answers::step::check_answers_step;
use super::confirmation::step::confirmation_step;

pub fn resuming_demo_journey() -> Value {
    journey(obj! {
        "code": "resuming-demo",
        "title": "Resuming a partially-completed journey",
        "path": "/resuming",
        "reachability": obj! {
            // When any request to this journey (including the root URL) includes
            // ?resume=true, Forge finds the furthest reachable step the user hasn't
            // completed yet and redirects there.
            "resumeWhen": query("resume").matches(condition::equals("true")),
        },
        // Load any saved draft answers before rendering so fields are pre-filled
        // and reachability conditions can evaluate against prior progress.
        "onAccess": [
            access(obj! {
                "effects": [effect::call("LoadDraftAnswers", vec!["resuming".into()])],
            }),
        ],
        "steps": [overview_step(), your_name_step(), your_role_step(), check_answers_step(), confirmation_step()],
    })
}
