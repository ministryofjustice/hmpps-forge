use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

pub fn heading() -> Value {
    govuk::HEADING.build(obj! {
        "text": "Read-only mode",
        "size": "l",
        "caption": "Pattern",
    })
}

pub fn intro() -> Value {
    govuk::BODY.build(obj! {
        "text": "A single page that renders different content depending on the\n  user's role. Admins see editable form fields and a save button.\n  Viewers see the same data as a read-only summary list. Both roles\n  share the same step definition — only the blocks differ via\n  visibleWhen conditions.",
    })
}

pub fn shows() -> Value {
    govuk::HEADING.build(obj! { "text": "What this pattern shows", "size": "s" })
}

pub fn shows_list() -> Value {
    govuk::LIST.build(obj! {
        "items": literal([
            "visibleWhen conditions driven by Session() role checks",
            "Two views of the same data on a single step: editable fields for admins, a summary list for viewers",
            "Pre-loaded record data seeded at login and persisted through draft answers",
            "Composing authentication and role guards with conditional rendering",
        ]),
        "style": "bullet",
    })
}

pub fn start_button() -> Value {
    govuk::LINK_BUTTON.build(obj! {
        "text": "Start the pattern",
        "href": "/forge-developer-guide/patterns/demos/read-only-mode/login",
        "isStartButton": true,
    })
}
