use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

pub fn heading() -> Value {
    govuk::HEADING.build(obj! {
        "text": "Branching based on an earlier answer",
        "size": "l",
        "caption": "Pattern",
    })
}

pub fn intro() -> Value {
    govuk::BODY.build(obj! {
        "text": "A sequential flow that routes the user down a different\n  path based on an earlier answer. In this demo they pick how\n  they want a visit to happen, and the next page asks only for\n  the details relevant to that choice. All branches converge\n  on a shared check-your-answers summary.",
    })
}

pub fn shows() -> Value {
    govuk::HEADING.build(obj! { "text": "What this pattern shows", "size": "s" })
}

pub fn shows_list() -> Value {
    govuk::LIST.build(obj! {
        "items": literal([
            "A radio question whose answer drives the next step",
            "Conditional redirects in a submit hook's next array, with first-match semantics",
            "Three branch steps that each collect different information",
            "A summary whose key, value, and change link adapt to the branch the user took",
            "A confirmation panel that resets the pattern when revisited",
        ]),
        "style": "bullet",
    })
}

pub fn start_button() -> Value {
    govuk::LINK_BUTTON.build(obj! {
        "text": "Start the pattern",
        "href": "/forge-developer-guide/patterns/demos/branching/visit-type",
        "isStartButton": true,
    })
}
