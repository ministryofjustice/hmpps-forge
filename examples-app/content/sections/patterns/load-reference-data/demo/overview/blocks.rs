use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

pub fn heading() -> Value {
    govuk::HEADING.build(obj! {
        "text": "Load reference data on access",
        "size": "l",
        "caption": "Pattern",
    })
}

pub fn intro() -> Value {
    govuk::BODY.build(obj! {
        "text": "An access hook loads data from an external source before the page renders.\n  The loaded values are available to blocks through Data() expressions. Each page\n  load fetches fresh data, simulating a call to a live API.",
    })
}

pub fn shows() -> Value {
    govuk::HEADING.build(obj! { "text": "What this pattern shows", "size": "s" })
}

pub fn shows_list() -> Value {
    govuk::LIST.build(obj! {
        "items": literal([
            "An effect that runs on every GET request via an access hook",
            "Data set by the effect and consumed by blocks through Data() references",
            "Fresh data on each page load, simulating a real API call",
            "A grid layout displaying the loaded values as a dashboard",
        ]),
        "style": "bullet",
    })
}

pub fn start_button() -> Value {
    govuk::LINK_BUTTON.build(obj! {
        "text": "See the demo",
        "href": "/forge-developer-guide/patterns/demos/load-reference-data/draw",
        "isStartButton": true,
    })
}
