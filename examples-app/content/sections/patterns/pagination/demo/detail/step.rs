use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::blocks::{heading, details, description, back_button};

pub fn detail_step() -> Value {
    step(obj! {
        "code": "detail",
        "path": "/detail/:index",
        "title": "Station details",
        "reachability": obj! { "entryWhen": true },
        "onAccess": [
            access(obj! {
                "effects": [effect::call("LoadStation", vec![])],
            }),
        ],
        "blocks": [heading(), details(), description(), back_button()],
    })
}
