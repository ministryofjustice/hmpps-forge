//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/task-list/demo/tasks/blocks.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;


fn task1_done() -> D {
    answer("yourDetailsStatus").matches(condition::equals("completed"))
}

fn task2_done() -> D {
    answer("visitPreferencesStatus").matches(condition::equals("completed"))
}

fn task3_done() -> D {
    answer("additionalNeedsStatus").matches(condition::equals("completed"))
}

fn prerequisites_met() -> D {
    and(vec![task1_done(), task2_done()])
}

fn all_complete() -> D {
    and(vec![prerequisites_met(), task3_done()])
}

fn locked_tag() -> D {
    D::V(obj! {
        "text": "Cannot start yet",
        "classes": D::from(forge_govuk_components::utility_classes()).get("Tag").get("Grey"),
    })
}

fn not_started_tag() -> D {
    D::V(obj! {
        "text": "Not yet started",
        "classes": D::from(forge_govuk_components::utility_classes()).get("Tag").get("Grey"),
    })
}

fn in_progress_tag() -> D {
    D::V(obj! {
        "text": "In progress",
        "classes": D::from(forge_govuk_components::utility_classes()).get("Tag").get("Blue"),
    })
}

fn completed_tag() -> D {
    D::V(obj! {
        "text": "Completed",
        "classes": D::from(forge_govuk_components::utility_classes()).get("Tag").get("Green"),
    })
}

#[allow(unused_variables)]
fn status_tag(code: D) -> D {
    match_(answer(code.clone()))
        .branch(condition::equals("completed"), completed_tag())
        .branch(condition::equals("in-progress"), in_progress_tag())
        .otherwise(not_started_tag())
}

pub fn heading() -> D {
    component(&govuk::HEADING, obj! { "text": "Book a prison visit", "size": "l" })
}

pub fn intro() -> D {
    component(&govuk::BODY, obj! { "text": "Complete each section before submitting your application." })
}

pub fn task_list() -> D {
    component(&govuk::TASK_LIST, obj! {
        "items": arr![
            obj! {
                "title": obj! { "text": "Your details" },
                "hint": obj! { "text": "Your name and relationship to the prisoner" },
                "href": "your-details/your-name",
                "status": obj! { "tag": status_tag(D::from("yourDetailsStatus")) },
            },
            obj! {
                "title": obj! { "text": "Visit preferences" },
                "hint": obj! { "text": "When you want to visit and the type of visit" },
                "href": "visit-preferences/preferred-day",
                "status": obj! { "tag": status_tag(D::from("visitPreferencesStatus")) },
            },
            obj! {
                "title": obj! { "text": "Additional needs" },
                "hint": obj! { "text": "Accessibility or other requirements" },
                "href": "additional-needs",
                "visibleWhen": prerequisites_met(),
                "status": obj! { "tag": status_tag(D::from("additionalNeedsStatus")) },
            },
            obj! {
                "title": obj! { "text": "Additional needs" },
                "hint": obj! { "text": "Accessibility or other requirements" },
                "visibleWhen": not(prerequisites_met()),
                "status": obj! { "tag": locked_tag() },
            },
            obj! {
                "title": obj! { "text": "Check and submit" },
                "hint": obj! { "text": "Review your answers and submit the application" },
                "href": "check-answers",
                "visibleWhen": all_complete(),
                "status": obj! { "tag": not_started_tag() },
            },
            obj! {
                "title": obj! { "text": "Check and submit" },
                "hint": obj! { "text": "Review your answers and submit the application" },
                "visibleWhen": not(all_complete()),
                "status": obj! { "tag": locked_tag() },
            },
        ],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        let _ = task1_done();
        let _ = task2_done();
        let _ = task3_done();
        let _ = prerequisites_met();
        let _ = all_complete();
        let _ = locked_tag();
        let _ = not_started_tag();
        let _ = in_progress_tag();
        let _ = completed_tag();
        let _ = heading();
        let _ = intro();
        let _ = task_list();
    });
}
