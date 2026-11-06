use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::overview::step::overview_step;
use super::list::step::list_step;
use super::detail::step::detail_step;

pub fn pagination_demo_journey() -> Value {
    journey(obj! {
        "code": "pagination-demo",
        "title": "Pagination",
        "path": "/pagination",
        "steps": [overview_step(), list_step(), detail_step()],
    })
}
