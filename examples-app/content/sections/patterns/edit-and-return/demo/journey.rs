use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::overview::step::overview_step;
use super::full_name::step::full_name_step;
use super::email_address::step::email_address_step;
use super::contact_preference::step::contact_preference_step;
use super::check_answers::step::check_answers_step;
use super::confirmation::step::confirmation_step;

pub fn edit_and_return_demo_journey() -> Value {
    journey(obj! {
        "code": "edit-and-return-demo",
        "title": "Edit and return",
        "path": "/edit-and-return",
        "onAccess": [
            access(obj! {
                "effects": [effect::call("LoadDraftAnswers", vec!["edit-and-return".into()])],
            }),
        ],
        "steps": [
            overview_step(),
            full_name_step(),
            email_address_step(),
            contact_preference_step(),
            check_answers_step(),
            confirmation_step(),
        ],
    })
}
