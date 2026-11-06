use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::overview::step::overview_step;
use super::agree_plan::step::agree_plan_step;
use super::manage_plan::step::manage_plan_step;
use super::confirmation::step::confirmation_step;

pub fn collection_validation_demo_journey() -> Value {
    journey(obj! {
        "code": "collection-validation-demo",
        "title": "Validating collections with iterators",
        "path": "/collection-validation",
        "onAccess": [
            access(obj! {
                "effects": [effect::call("LoadPlanGoals", vec![])],
            }),
        ],
        "steps": [overview_step(), manage_plan_step(), agree_plan_step(), confirmation_step()],
    })
}
