use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

pub fn heading() -> Value {
    govuk::HEADING.build(obj! {
        "text": "Edit and return",
        "size": "l",
        "caption": "Pattern",
    })
}

pub fn intro() -> Value {
    govuk::BODY.build(obj! {
        "text": "A check-your-answers page with change links that jump the user to\n  a specific step and return them to the summary after saving. The normal\n  linear flow is preserved for first-time users; the return-to-summary\n  behaviour only activates when arriving via a change link.",
    })
}

pub fn shows() -> Value {
    govuk::HEADING.build(obj! { "text": "What this pattern shows", "size": "s" })
}

pub fn shows_list() -> Value {
    govuk::LIST.build(obj! {
        "items": literal([
            "Change links that append a ?returnTo=check-answers query parameter",
            "Conditional redirects that check Query(\"returnTo\") before choosing the next step",
            "First-time users follow the linear flow; reviewers jump straight back to the summary",
            "A summary page with the GOV.UK summary list and change links",
            "Confirmation and reset after submission",
        ]),
        "style": "bullet",
    })
}

pub fn start_button() -> Value {
    govuk::LINK_BUTTON.build(obj! {
        "text": "Start the pattern",
        "href": "/forge-developer-guide/patterns/demos/edit-and-return/full-name",
        "isStartButton": true,
    })
}
