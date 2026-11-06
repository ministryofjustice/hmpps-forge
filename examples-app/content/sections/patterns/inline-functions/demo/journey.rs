use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::overview::step::overview_step;
use super::before::step::before_step;
use super::after::step::after_step;

pub fn inline_functions_demo_journey() -> Value {
    journey(obj! {
        "code": "inline-functions-demo",
        "title": "Shaping data inline",
        "path": "/inline-functions",
        "steps": [overview_step(), before_step(), after_step()],
    })
}
