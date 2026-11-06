use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

pub fn heading() -> Value {
    govuk::HEADING.build(obj! {
        "text": "Validating collections with iterators",
        "size": "l",
        "caption": "Pattern",
    })
}

pub fn intro() -> Value {
    govuk::BODY.build(obj! {
        "text": "A plan has a list of goals loaded from an API. Each active goal\n  must have at least one action before the plan can be agreed. The\n  validWhen array uses Iterator.Filter and Iterator.Map to produce a\n  separate error message per goal that is missing actions.",
    })
}

pub fn shows() -> Value {
    govuk::HEADING.build(obj! { "text": "What this pattern shows", "size": "s" })
}

pub fn shows_list() -> Value {
    govuk::LIST.build(obj! {
        "items": literal([
            "An iterator chain as a validation condition: filter then count",
            "An iterate that yields validation() expressions for per-item error messages",
            "Mixing standard field validation with data-driven collection validation on the same field",
        ]),
        "style": "bullet",
    })
}

pub fn start_button() -> Value {
    govuk::LINK_BUTTON.build(obj! {
        "text": "Start the pattern",
        "href": "/forge-developer-guide/patterns/demos/collection-validation/agree-plan",
        "isStartButton": true,
    })
}
