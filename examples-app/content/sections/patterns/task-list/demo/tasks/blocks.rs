use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;
use forge_govuk_components::classes;

// Completion predicates for gating tasks and the submit button
fn task1_done() -> Value {
    answer("yourDetailsStatus").matches(condition::equals("completed"))
}

fn task2_done() -> Value {
    answer("visitPreferencesStatus").matches(condition::equals("completed"))
}

fn task3_done() -> Value {
    answer("additionalNeedsStatus").matches(condition::equals("completed"))
}

fn prerequisites_met() -> Value {
    and(vec![task1_done(), task2_done()])
}

fn all_complete() -> Value {
    and(vec![prerequisites_met(), task3_done()])
}

// Tag objects using the classes::tag colour constants
fn locked_tag() -> Value {
    obj! { "text": "Cannot start yet", "classes": classes::tag::GREY }
}

fn not_started_tag() -> Value {
    obj! { "text": "Not yet started", "classes": classes::tag::GREY }
}

fn in_progress_tag() -> Value {
    obj! { "text": "In progress", "classes": classes::tag::BLUE }
}

fn completed_tag() -> Value {
    obj! { "text": "Completed", "classes": classes::tag::GREEN }
}

// Maps a status answer to a complete tag object (text + colour)
fn status_tag(code: &str) -> Value {
    match_(answer(code))
        .branch(condition::equals("completed"), completed_tag())
        .branch(condition::equals("in-progress"), in_progress_tag())
        .otherwise(not_started_tag())
        .into()
}

pub fn heading() -> Value {
    govuk::HEADING.build(obj! {
        "text": "Book a prison visit",
        "size": "l",
    })
}

pub fn intro() -> Value {
    govuk::BODY.build(obj! {
        "text": "Complete each section before submitting your application.",
    })
}

pub fn task_list() -> Value {
    govuk::TASK_LIST.build(obj! {
        "items": [
            // hrefs point into child journeys: journey-path/step-path
            obj! {
                "title": obj! { "text": "Your details" },
                "hint": obj! { "text": "Your name and relationship to the prisoner" },
                "href": "your-details/your-name",
                "status": obj! { "tag": status_tag("yourDetailsStatus") },
            },
            obj! {
                "title": obj! { "text": "Visit preferences" },
                "hint": obj! { "text": "When you want to visit and the type of visit" },
                "href": "visit-preferences/preferred-day",
                "status": obj! { "tag": status_tag("visitPreferencesStatus") },
            },
            // Dual items: unlocked (with href) and locked (no href) — only one visible at a time
            obj! {
                "title": obj! { "text": "Additional needs" },
                "hint": obj! { "text": "Accessibility or other requirements" },
                "href": "additional-needs",
                "visibleWhen": prerequisites_met(),
                "status": obj! { "tag": status_tag("additionalNeedsStatus") },
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
