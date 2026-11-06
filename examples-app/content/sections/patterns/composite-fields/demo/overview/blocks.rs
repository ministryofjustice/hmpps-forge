use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

pub fn heading() -> Value {
    govuk::HEADING.build(obj! {
        "text": "Multi-part composite fields",
        "size": "l",
        "caption": "Pattern",
    })
}

pub fn intro() -> Value {
    govuk::BODY.build(obj! {
        "text": "Fields that are conceptually one value, but collected\n  through several inputs. Two common flavours turn up: a\n  component that owns the composition internally (date of\n  birth), and separate fields laid out together that the author\n  composes at display time (a postal address).",
    })
}

pub fn shows() -> Value {
    govuk::HEADING.build(obj! { "text": "What this pattern shows", "size": "s" })
}

pub fn shows_list() -> Value {
    govuk::LIST.build(obj! {
        "items": literal([
            "A component-owned composite with GovUKDateInputFull (day, month, year) that outputs one ISO date",
            "Pre-built field-specific validations for empty, missing part, and invalid date errors",
            "An author-owned composite where several text inputs on one step describe one address",
            "A summary list that formats the date and renders the address as multi-line output",
            "Optional fields that only contribute to the composed display when filled in",
        ]),
        "style": "bullet",
    })
}

pub fn start_button() -> Value {
    govuk::LINK_BUTTON.build(obj! {
        "text": "Start the pattern",
        "href": "/forge-developer-guide/patterns/demos/composite-fields/date-of-birth",
        "isStartButton": true,
    })
}
