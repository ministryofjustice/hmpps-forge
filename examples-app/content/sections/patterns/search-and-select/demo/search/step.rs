use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::blocks::{heading, search_input, search_button, results_heading, results_list};

pub fn search_step() -> Value {
    step(obj! {
        "code": "search",
        "path": "/search",
        "title": "Search stations",
        "reachability": obj! { "entryWhen": true },
        "onAccess": [
            access(obj! {
                "effects": [
                    effect::call("LoadDraftAnswers", vec!["search-and-select".into()]),
                    effect::call("SearchStations", vec![]),
                ],
            }),
        ],
        "blocks": [heading(), search_input(), search_button(), results_heading(), results_list()],
        "onSubmission": [
            submit(obj! {
                "validate": false,
                "onAlways": obj! {
                    "effects": [effect::call("SaveDraftAnswers", vec!["search-and-select".into()])],
                    "next": [redirect(obj! { "goto": "search" })],
                },
            }),
        ],
    })
}
