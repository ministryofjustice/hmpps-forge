use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::blocks::{heading, page_info, station_list, pagination};

pub fn list_step() -> Value {
    step(obj! {
        "code": "list",
        "path": "/list",
        "title": "Stations",
        "reachability": obj! { "entryWhen": true },
        "onAccess": [
            access(obj! {
                "effects": [effect::call("LoadStationPage", vec![])],
            }),
        ],
        "blocks": [heading(), page_info(), station_list(), pagination()],
    })
}
