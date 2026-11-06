//! Ported from `examples-app/server/journeys/forge-developer-guide/steps/search/blocks.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;


pub fn heading() -> D {
    component(&govuk::HEADING, obj! { "text": "Search the guide", "size": "l" })
}

pub fn search_form() -> D {
    component(&core_blocks::TEMPLATE_WRAPPER, obj! {
        "template": "<form method=\"get\" role=\"search\">\n    <label class=\"govuk-label\" for=\"guide-page-search-input\">Enter a keyword or concept</label>\n    <div class=\"guide-search-panel__form\">\n      <input class=\"govuk-input guide-search-panel__input\" id=\"guide-page-search-input\" type=\"search\" name=\"q\" value=\"{{query}}\">\n      <button class=\"guide-search-panel__submit\" type=\"submit\">\n        <svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\" focusable=\"false\">\n          <circle cx=\"11\" cy=\"11\" r=\"8\"/>\n          <line x1=\"21\" y1=\"21\" x2=\"16.65\" y2=\"16.65\"/>\n        </svg>\n        <span class=\"govuk-visually-hidden\">Search</span>\n      </button>\n    </div>\n  </form>",
        "values": obj! {
            "query": data("searchQuery").pipe(vec![D::from(transformer::string::escape_html())]),
        },
    })
}

pub fn search_results() -> D {
    component(&core_blocks::COLLECTION_BLOCK, obj! {
        "collection": data("searchResults").each(iterator::map(component(&core_blocks::HTML, obj! {
            "tag": "li",
            "classes": "guide-search-results__item",
            "content": arr![
                component(&core_blocks::HTML, obj! {
                    "tag": "a",
                    "classes": template(vec![
                        D::from("govuk-link govuk-link--no-visited-state "),
                        D::from(forge_govuk_components::utility_classes())
                            .get("FontSize")
                            .get("Size27"),
                        D::from(""),
                    ]),
                    "attributes": obj! { "href": item().path("href") },
                    "content": item().path("title"),
                }),
                component(&govuk::BODY, obj! {
                    "text": item().path("excerpt"),
                    "size": "s",
                    "classes": "govuk-!-margin-top-1",
                }),
                component(&core_blocks::COLLECTION_BLOCK, obj! {
                    "collection": item()
                        .path("sections")
                        .each(iterator::map(component(&core_blocks::HTML, obj! {
                            "tag": "li",
                            "content": component(&core_blocks::HTML, obj! {
                                "tag": "a",
                                "classes": "govuk-link govuk-link--no-visited-state govuk-body-s",
                                "attributes": obj! { "href": item().path("href") },
                                "content": item().path("heading"),
                            }),
                        }))),
                    "tag": "ul",
                    "classes": "govuk-list govuk-list--bullet govuk-!-margin-top-1",
                }),
            ],
        }))),
        "fallback": arr![component(&govuk::INSET_TEXT, obj! { "text": "No results found.", "visibleWhen": data("searchQuery") })],
        "tag": "ul",
        "classes": "govuk-list guide-search-results",
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        let _ = heading();
        let _ = search_form();
        let _ = search_results();
    });
}
