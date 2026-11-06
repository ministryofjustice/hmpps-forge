use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::overview::step::overview_step;
use super::search::step::search_step;
use super::log::step::log_step;

pub fn search_and_select_demo_journey() -> Value {
    journey(obj! {
        "code": "search-and-select-demo",
        "title": "Search and select",
        "path": "/search-and-select",
        "onAccess": [
            access(obj! {
                "effects": [effect::call("LoadDraftAnswers", vec!["search-and-select".into()])],
            }),
        ],
        "steps": [overview_step(), search_step(), log_step()],
    })
}
