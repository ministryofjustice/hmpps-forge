use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::overview::step::overview_step;
use super::find_address::step::find_address_step;
use super::check_answers::step::check_answers_step;
use super::confirmation::step::confirmation_step;

pub fn pre_fill_demo_journey() -> Value {
    journey(obj! {
        "code": "pre-fill-demo",
        "title": "Pre-fill from an external system",
        "path": "/pre-fill",
        "onAccess": [
            access(obj! {
                "effects": [effect::call("LoadDraftAnswers", vec!["pre-fill".into()])],
            }),
        ],
        "steps": [overview_step(), find_address_step(), check_answers_step(), confirmation_step()],
    })
}
