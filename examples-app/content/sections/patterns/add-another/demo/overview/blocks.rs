use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

pub fn heading() -> Value {
    govuk::HEADING.build(obj! {
        "text": "Adding, editing and deleting from collections",
        "size": "l",
        "caption": "Pattern",
    })
}

pub fn intro() -> Value {
    govuk::BODY.build(obj! {
        "text": "A list page that lets users build a collection one item\n  at a time. Each item is collected on a separate form page, then\n  displayed as a summary card with change and remove links. The\n  user can add items, edit existing ones, remove items through a\n  confirmation step, or continue to check their answers.",
    })
}

pub fn shows() -> Value {
    govuk::HEADING.build(obj! { "text": "What this pattern shows", "size": "s" })
}

pub fn shows_list() -> Value {
    govuk::LIST.build(obj! {
        "items": literal([
            "A list page that renders items using CollectionBlock and Iterator.Map",
            "An \"Add another\" button that loops back to the form without validation",
            "Change links that pre-fill the edit page from the existing item",
            "Remove links that navigate to a confirmation page before deleting",
            "Submit hooks that route \"add another\" and \"continue\" to different steps",
            "A fallback message when the collection is empty",
        ]),
        "style": "bullet",
    })
}

pub fn start_button() -> Value {
    govuk::LINK_BUTTON.build(obj! {
        "text": "Start the pattern",
        "href": "/forge-developer-guide/patterns/demos/add-another/your-contacts",
        "isStartButton": true,
    })
}
