use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;
use forge_core::builtins::components as core_blocks;

pub fn heading() -> Value {
    govuk::HEADING.build(obj! { "text": "Stations", "size": "l" })
}

pub fn page_info() -> Value {
    govuk::BODY.build(obj! {
        "text": format("Page %1 of %2", [data("currentPage").into(), data("pages").pipe([transformer::array::length()]).into()]),
        "classes": "govuk-!-margin-bottom-6",
    })
}

pub fn station_list() -> Value {
    core_blocks::COLLECTION_BLOCK.build(obj! {
        "collection": data("stations").each(iterator::map(core_blocks::HTML.build(obj! {
            "tag": "div",
            "classes": "govuk-!-margin-bottom-4",
            "content": [
                core_blocks::HTML.build(obj! {
                    "tag": "a",
                    "classes": "govuk-link govuk-heading-s govuk-!-margin-bottom-1",
                    "attributes": obj! { "href": item().path("href") },
                    "content": item().path("name"),
                }),
                govuk::BODY.build(obj! {
                    "text": format("Lines: %1 — Zone %2", [item().path("lines").into(), item().path("zone").into()]),
                    "size": "s",
                }),
            ],
        }))),
    })
}

// This pagination() is achievable and performant in Forge, but that does not
// always mean this is the nicest authoring shape for a real service.
// In practice, `derive____` effect hooks can be a useful way to shape API/DB
// data into component-ready view models before blocks render.
pub fn pagination() -> Value {
    govuk::PAGINATION.build(obj! {
        "previous": obj! {
            "href": format("?page=%1", [data("currentPage").pipe([transformer::number::add(-1)]).into()]),
            "visibleWhen": data("currentPage").matches(condition::number::greater_than(1)),
        },
        "next": obj! {
            "href": format("?page=%1", [data("currentPage").pipe([transformer::number::add(1)]).into()]),
            "visibleWhen": data("currentPage").matches(condition::number::less_than(data("pages").pipe([transformer::array::length()]))),
        },
        "items": data("pages").each(iterator::map(obj! {
            "number": Loop.index(),
            "href": format("?page=%1", [Loop.index().into()]),
            "current": Loop.index().matches(condition::equals(data("currentPage"))),
        })),
    })
}
