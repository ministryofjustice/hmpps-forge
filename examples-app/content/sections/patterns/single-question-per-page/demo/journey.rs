use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::overview::step::overview_step;
use super::your_name::step::your_name_step;
use super::your_role::step::your_role_step;
use super::check_answers::step::check_answers_step;
use super::confirmation::step::confirmation_step;

// The demo journey loads any draft answers stored in the session on every access so
// the user can jump between steps without losing their progress.
pub fn single_question_per_page_demo_journey() -> Value {
    journey(obj! {
        "code": "single-question-per-page-demo",
        "title": "Single question per page",
        "path": "/single-question-per-page",
        "onAccess": [
            access(obj! {
                "effects": [effect::call("LoadDraftAnswers", vec!["single-question-per-page".into()])],
            }),
        ],
        "steps": [overview_step(), your_name_step(), your_role_step(), check_answers_step(), confirmation_step()],
    })
}
