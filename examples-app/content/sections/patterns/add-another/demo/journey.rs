use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::overview::step::overview_step;
use super::your_contacts::step::your_contacts_step;
use super::add_contact::step::add_contact_step;
use super::edit_contact::step::edit_contact_step;
use super::delete_contact::step::delete_contact_step;
use super::check_answers::step::check_answers_step;
use super::confirmation::step::confirmation_step;

pub fn add_another_demo_journey() -> Value {
    journey(obj! {
        "code": "add-another-demo",
        "title": "Adding, editing and deleting from collections",
        "path": "/add-another",
        "onAccess": [
            access(obj! {
                "effects": [effect::call("LoadDraftAnswers", vec!["add-another".into()])],
            }),
        ],
        "steps": [
            overview_step(),
            your_contacts_step(),
            add_contact_step(),
            edit_contact_step(),
            delete_contact_step(),
            check_answers_step(),
            confirmation_step(),
        ],
    })
}
