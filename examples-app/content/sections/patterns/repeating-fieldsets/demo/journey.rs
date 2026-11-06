use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::overview::step::overview_step;
use super::household_members::step::household_members_step;
use super::check_answers::step::check_answers_step;
use super::confirmation::step::confirmation_step;

pub fn repeating_fieldsets_demo_journey() -> Value {
    journey(obj! {
        "code": "repeating-fieldsets-demo",
        "title": "Repeating fieldsets",
        "path": "/repeating-fieldsets",
        "steps": [overview_step(), household_members_step(), check_answers_step(), confirmation_step()],
    })
}
