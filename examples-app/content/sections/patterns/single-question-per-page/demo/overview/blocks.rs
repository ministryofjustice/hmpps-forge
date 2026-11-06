use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

pub fn heading() -> Value {
    govuk::HEADING.build(obj! {
        "text": "Single question per page",
        "size": "l",
        "caption": "Pattern",
    })
}

pub fn intro() -> Value {
    govuk::BODY.build(obj! {
        "text": "A sequential flow that asks one question per page. Each submission is validated,\n  then the user progresses to the next question. A check-your-answers page lets\n  them review and change individual answers before confirming.",
    })
}

pub fn shows() -> Value {
    govuk::HEADING.build(obj! { "text": "What this pattern shows", "size": "s" })
}

pub fn shows_list() -> Value {
    govuk::LIST.build(obj! {
        "items": literal([
            "One field per step with a form-level Continue button",
            "Validation rules on every submission, with inline error messages",
            "Answers persisted between steps using the session",
            "A summary page with \"Change\" links that return the user to the original step",
            "A final confirmation panel after submission",
        ]),
        "style": "bullet",
    })
}

pub fn start_button() -> Value {
    govuk::LINK_BUTTON.build(obj! {
        "text": "Start the pattern",
        "href": "/forge-developer-guide/patterns/demos/single-question-per-page/your-name",
        "isStartButton": true,
    })
}
