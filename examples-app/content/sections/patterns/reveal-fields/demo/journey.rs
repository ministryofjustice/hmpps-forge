use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::overview::step::overview_step;
use super::heard_from::step::heard_from_step;
use super::check_answers::step::check_answers_step;
use super::confirmation::step::confirmation_step;

// The demo loads any stored draft answers on access so the radio and any revealed
// follow-up inputs are pre-filled when the user returns via the change link.
pub fn reveal_fields_demo_journey() -> Value {
    journey(obj! {
        "code": "reveal-fields-demo",
        "title": "Reveal fields",
        "path": "/reveal-fields",
        "onAccess": [
            access(obj! {
                "effects": [effect::call("LoadDraftAnswers", vec!["reveal-fields".into()])],
            }),
        ],
        "steps": [overview_step(), heard_from_step(), check_answers_step(), confirmation_step()],
    })
}
