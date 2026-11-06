use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::blocks::{heading, intro, shows, shows_list, start_button};

pub fn overview_step() -> Value {
    step(obj! {
        "path": "/overview",
        "title": "Validating collections with iterators",
        "reachability": obj! { "entryWhen": true },
        "metadata": obj! { "hiddenFromNav": true },
        "blocks": [heading(), intro(), shows(), shows_list(), start_button()],
    })
}
