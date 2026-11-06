use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;
use forge_core::builtins::components as core_blocks;

pub fn heading() -> Value {
    govuk::HEADING.build(obj! { "text": "Blog posts", "size": "l" })
}

pub fn post_count() -> Value {
    govuk::BODY.build(obj! {
        "text": format("%1 posts published", [data("postCount").into()]),
        "visibleWhen": data("postCount").matches(condition::is_required()),
    })
}

pub fn write_button() -> Value {
    govuk::LINK_BUTTON.build(obj! {
        "text": "Write a new post",
        "href": "/forge-developer-guide/patterns/demos/cms-content/write",
        "classes": "govuk-button--secondary",
    })
}

pub fn posts_list() -> Value {
    core_blocks::COLLECTION_BLOCK.build(obj! {
        "collection": data("posts").each(iterator::map(core_blocks::HTML.build(obj! {
            "tag": "article",
            "classes": "govuk-!-margin-bottom-8",
            "content": [
                govuk::HEADING.build(obj! {
                    "text": item().path("title"),
                    "size": "m",
                }),
                govuk::BODY.build(obj! {
                    "text": item().path("date"),
                    "size": "s",
                    "classes": "govuk-!-colour-secondary",
                }),
                core_blocks::HTML.build(obj! {
                    "content": item().path("body"),
                }),
                core_blocks::HTML.build(obj! {
                    "tag": "hr",
                    "classes": "govuk-section-break govuk-section-break--visible govuk-!-margin-top-6",
                }),
            ],
        }))),
    })
}

pub fn empty_state() -> Value {
    govuk::INSET_TEXT.build(obj! {
        "text": "No posts yet. Write your first post to get started.",
        "visibleWhen": data("postCount").not().matches(condition::is_required()),
    })
}
