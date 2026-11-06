use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

pub fn heading() -> Value {
    govuk::HEADING.build(obj! {
        "text": "Search and select",
        "size": "l",
        "caption": "Pattern",
    })
}

pub fn intro() -> Value {
    govuk::BODY.build(obj! {
        "text": "A search page that accepts user input, runs a query against a\n  data source, and displays matching results. The user selects a\n  result to view its full details. This demo searches a directory\n  of London Underground stations by name.",
    })
}

pub fn shows() -> Value {
    govuk::HEADING.build(obj! { "text": "What this pattern shows", "size": "s" })
}

pub fn shows_list() -> Value {
    govuk::LIST.build(obj! {
        "items": literal([
            "A text input submitted via POST that triggers a search effect on redirect",
            "CollectionBlock with Data() to render dynamic search results",
            "Item() path accessors inside an Iterator.Map to display each result",
            "A detail page that loads a specific record by route parameter",
        ]),
        "style": "bullet",
    })
}

pub fn start_button() -> Value {
    govuk::LINK_BUTTON.build(obj! {
        "text": "Start the pattern",
        "href": "/forge-developer-guide/patterns/demos/search-and-select/search",
        "isStartButton": true,
    })
}
