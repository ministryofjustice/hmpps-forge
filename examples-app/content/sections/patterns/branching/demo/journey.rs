use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::overview::step::overview_step;
use super::visit_type::step::visit_type_step;
use super::location::step::location_step;
use super::video_email::step::video_email_step;
use super::phone_number::step::phone_number_step;
use super::check_answers::step::check_answers_step;
use super::confirmation::step::confirmation_step;

// The demo loads any stored draft answers on every access so switching between
// branches preserves earlier input; the summary page filters rows to the
// branch the user is currently on.
pub fn branching_demo_journey() -> Value {
    journey(obj! {
        "code": "branching-demo",
        "title": "Branching based on an earlier answer",
        "path": "/branching",
        "onAccess": [
            access(obj! {
                "effects": [effect::call("LoadDraftAnswers", vec!["branching".into()])],
            }),
        ],
        "steps": [
            overview_step(),
            visit_type_step(),
            location_step(),
            video_email_step(),
            phone_number_step(),
            check_answers_step(),
            confirmation_step(),
        ],
    })
}
