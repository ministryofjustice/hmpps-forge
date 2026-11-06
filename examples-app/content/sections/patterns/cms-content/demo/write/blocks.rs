use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;
use crate::components::RICH_TEXT_EDITOR;

pub fn heading() -> Value {
    govuk::HEADING.build(obj! { "text": "Write a post", "size": "l" })
}

pub fn title_input() -> Value {
    govuk::TEXT_INPUT.build(obj! {
        "code": "postTitle",
        "label": obj! { "text": "Title", "classes": "govuk-label--m" },
        "validWhen": [
            validation(obj! {
                "condition": self_().matches(condition::is_required()),
                "message": "Enter a title",
            }),
        ],
    })
}

pub fn body_editor() -> Value {
    RICH_TEXT_EDITOR.build(obj! {
        "code": "postBody",
        "label": obj! { "text": "Content", "classes": "govuk-label--m" },
        "hint": "Use the toolbar to format your post.",
        "validWhen": [
            validation(obj! {
                "condition": self_().matches(condition::is_required()),
                "message": "Enter some content",
            }),
        ],
    })
}

pub fn publish_button() -> Value {
    govuk::BUTTON.build(obj! { "text": "Publish post" })
}
