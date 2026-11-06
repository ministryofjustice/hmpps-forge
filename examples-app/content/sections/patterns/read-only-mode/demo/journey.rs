use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::overview::step::overview_step;
use super::login::step::login_step;
use super::contacts::step::contacts_step;
use super::record::step::record_step;

pub fn read_only_mode_demo_journey() -> Value {
    journey(obj! {
        "code": "read-only-mode-demo",
        "title": "Read-only mode",
        "path": "/read-only-mode",
        "onAccess": [
            access(obj! {
                "effects": [effect::call("LoadDraftAnswers", vec!["read-only-mode".into()])],
            }),
        ],
        "steps": [overview_step(), login_step(), contacts_step(), record_step()],
    })
}
