use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

pub fn heading() -> Value {
    govuk::HEADING.build(obj! {
        "text": "Reveal fields",
        "size": "l",
        "caption": "Pattern",
    })
}

pub fn intro() -> Value {
    govuk::BODY.build(obj! {
        "text": "A single-page question that reveals an extra input when\n  the user picks an option that needs more detail. In this demo\n  they pick how they heard about the service, and 2 of the 4\n  options ask a follow-up question inline.",
    })
}

pub fn shows() -> Value {
    govuk::HEADING.build(obj! { "text": "What this pattern shows", "size": "s" })
}

pub fn shows_list() -> Value {
    govuk::LIST.build(obj! {
        "items": literal([
            "A radio field with a `block` attached to specific options",
            "Follow-up inputs that only validate when their parent option is selected (dependentWhen)",
            "A single step that captures the choice and the follow-up together",
            "A summary that shows the follow-up answer only when it applies",
        ]),
        "style": "bullet",
    })
}

pub fn start_button() -> Value {
    govuk::LINK_BUTTON.build(obj! {
        "text": "Start the pattern",
        "href": "/forge-developer-guide/patterns/demos/reveal-fields/heard-from",
        "isStartButton": true,
    })
}
