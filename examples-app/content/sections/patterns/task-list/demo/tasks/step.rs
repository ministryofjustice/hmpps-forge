use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::blocks::{heading, intro, task_list};

pub fn tasks_step() -> Value {
    step(obj! {
        "code": "tasks",
        "path": "/tasks",
        "title": "Book a prison visit",
        "reachability": obj! { "entryWhen": true },
        "blocks": [heading(), intro(), task_list()],
    })
}
