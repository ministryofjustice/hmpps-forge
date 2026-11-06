use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;
use forge_govuk_components::classes;
use forge_core::builtins::components as core_blocks;

pub fn heading() -> Value {
    govuk::HEADING.build(obj! { "text": "Search stations", "size": "l" })
}

pub fn search_input() -> Value {
    govuk::TEXT_INPUT.build(obj! {
        "code": "searchQuery",
        "label": obj! { "text": "Station name" },
        "hint": obj! { "text": "Try searching for King, Brixton, or Piccadilly" },
        "classes": classes::input::WIDTH_20,
    })
}

pub fn search_button() -> Value {
    govuk::BUTTON.build(obj! { "text": "Search" })
}

pub fn results_heading() -> Value {
    govuk::HEADING.build(obj! {
        "text": "Results",
        "size": "m",
        "visibleWhen": data("hasSearched").matches(condition::is_required()),
    })
}

pub fn results_list() -> Value {
    core_blocks::COLLECTION_BLOCK.build(obj! {
        "collection": data("searchResults").each(iterator::map(core_blocks::HTML.build(obj! {
            "tag": "div",
            "classes": "govuk-!-margin-bottom-6",
            "content": [
                govuk::HEADING.build(obj! {
                    "text": item().path("name"),
                    "size": "s",
                }),
                govuk::BODY.build(obj! {
                    "text": format("Lines: %1 — Zone %2", [item().path("lines").into(), item().path("zone").into()]),
                    "size": "s",
                }),
                core_blocks::HTML.build(obj! {
                    "tag": "a",
                    "classes": "govuk-link",
                    "attributes": obj! { "href": item().path("href") },
                    "content": "View station details",
                }),
            ],
        }))),
        "fallback": [
            govuk::INSET_TEXT.build(obj! {
                "text": "No matching stations found.",
                "visibleWhen": data("hasSearched").matches(condition::is_required()),
            }),
        ],
    })
}
