use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::overview::step::overview_step;
use super::tasks::step::tasks_step;
use super::your_details::journey::your_details_journey;
use super::visit_preferences::journey::visit_preferences_journey;
use super::additional_needs::step::additional_needs_step;
use super::check_answers::step::check_answers_step;
use super::confirmation::step::confirmation_step;

pub fn task_list_demo_journey() -> Value {
    journey(obj! {
        "code": "task-list-demo",
        "title": "Task list",
        "path": "/task-list",
        // Load saved progress before rendering any step (including the task list hub)
        "onAccess": [
            access(obj! {
                "effects": [effect::call("LoadDraftAnswers", vec!["task-list".into()])],
            }),
        ],
        "steps": [overview_step(), tasks_step(), additional_needs_step(), check_answers_step(), confirmation_step()],
        // Multi-step sections modelled as child journeys
        "children": [your_details_journey(), visit_preferences_journey()],
    })
}
