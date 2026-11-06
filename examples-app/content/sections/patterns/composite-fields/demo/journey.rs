use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::overview::step::overview_step;
use super::date_of_birth::step::date_of_birth_step;
use super::address::step::address_step;
use super::check_answers::step::check_answers_step;
use super::confirmation::step::confirmation_step;

// The demo loads stored draft answers on access so every step is pre-filled when the
// user navigates back via a change link on the summary.
pub fn composite_fields_demo_journey() -> Value {
    journey(obj! {
        "code": "composite-fields-demo",
        "title": "Multi-part composite fields",
        "path": "/composite-fields",
        "onAccess": [
            access(obj! {
                "effects": [effect::call("LoadDraftAnswers", vec!["composite-fields".into()])],
            }),
        ],
        "steps": [overview_step(), date_of_birth_step(), address_step(), check_answers_step(), confirmation_step()],
    })
}
