use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;
use forge_core::builtins::components as core_blocks;

pub fn heading() -> Value {
    govuk::HEADING.build(obj! {
        "text": "Check your answers",
    })
}

pub fn member_summaries() -> Value {
    core_blocks::COLLECTION_BLOCK.build(obj! {
        "collection": data("members").each(iterator::map(govuk::SUMMARY_LIST.build(obj! {
            "card": obj! {
                "title": obj! { "text": item().path("memberName") },
            },
            "rows": [
                obj! {
                    "key": obj! { "text": "Age" },
                    "value": obj! { "text": item().path("memberAge") },
                },
            ],
        }))),
        "fallback": Vec::<Value>::new(),
    })
}

pub fn change_link() -> Value {
    govuk::LINK_BUTTON.build(obj! {
        "text": "Change household members",
        "href": "household-members",
        "classes": "govuk-button--secondary",
    })
}

pub fn confirm_body() -> Value {
    govuk::BODY.build(obj! {
        "text": "Selecting \"Confirm\" will save your answers.",
    })
}

pub fn submit_button() -> Value {
    govuk::BUTTON.build(obj! { "text": "Confirm" })
}
