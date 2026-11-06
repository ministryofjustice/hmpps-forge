use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::overview::step::overview_step;
use super::draw::step::draw_step;

pub fn load_reference_data_demo_journey() -> Value {
    journey(obj! {
        "code": "load-reference-data-demo",
        "title": "Load reference data on access",
        "path": "/load-reference-data",
        "onAccess": [
            access(obj! {
                "effects": [effect::call("DrawLotteryNumbers", vec![])],
            }),
        ],
        "steps": [overview_step(), draw_step()],
    })
}
