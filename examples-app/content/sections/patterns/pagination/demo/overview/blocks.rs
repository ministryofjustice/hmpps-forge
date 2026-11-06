use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

pub fn heading() -> Value {
    govuk::HEADING.build(obj! {
        "text": "Pagination",
        "size": "l",
        "caption": "Pattern",
    })
}

pub fn intro() -> Value {
    govuk::BODY.build(obj! {
        "text": "A paginated list that splits a large data set across multiple\n  pages. The user navigates between pages using Previous and Next\n  links. This demo paginates a directory of London Underground\n  stations, showing five per page.",
    })
}

pub fn shows() -> Value {
    govuk::HEADING.build(obj! { "text": "What this pattern shows", "size": "s" })
}

pub fn shows_list() -> Value {
    govuk::LIST.build(obj! {
        "items": literal([
            "Reading a query parameter on access to determine the current page",
            "Slicing a data set in an effect and setting pagination metadata as Data",
            "CollectionBlock with Data() to render the current page of results",
            "Conditional Previous and Next links using visibleWhen with Data checks",
        ]),
        "style": "bullet",
    })
}

pub fn start_button() -> Value {
    govuk::LINK_BUTTON.build(obj! {
        "text": "Start the pattern",
        "href": "/forge-developer-guide/patterns/demos/pagination/list",
        "isStartButton": true,
    })
}
