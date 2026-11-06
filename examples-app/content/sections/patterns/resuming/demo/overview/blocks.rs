use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

// The journey's LoadAnswers effect seeds any stored answers before the
// overview renders, so a single known answer tells us the user has saved
// progress to resume into.
pub fn has_saved_progress() -> Value {
    answer("fullName").matches(condition::is_required()).into()
}

pub fn heading() -> Value {
    govuk::HEADING.build(obj! {
        "text": "Resuming a partially-completed journey",
        "size": "l",
        "caption": "Pattern",
    })
}

pub fn intro() -> Value {
    govuk::BODY.build(obj! {
        "text": "A service that lets users leave and come back later.\n  When the user visits the journey root, Forge picks the step\n  they still need to complete and redirects them there.",
    })
}

pub fn shows() -> Value {
    govuk::HEADING.build(obj! { "text": "What this pattern shows", "size": "s" })
}

pub fn shows_list() -> Value {
    govuk::LIST.build(obj! {
        "items": literal([
            "A `resumeWhen` condition that triggers resume when the user returns with `?resume=true`",
            "Question steps that define where the user goes next after answering",
        ]),
        "style": "bullet",
    })
}

pub fn resume_panel() -> Value {
    govuk::INSET_TEXT.build(obj! {
        "text": "You have saved answers from a previous visit. Clicking\n  continue takes you back to the journey with resume enabled,\n  which redirects you to where you left off.",
        "visibleWhen": has_saved_progress().clone(),
    })
}

// Here we create a button that redirects to the journey, but with
// `?resume=true` added. This triggers our `resumeWhen` condition on the journey
// which is what enabled the resume redirect to trigger.
pub fn continue_button() -> Value {
    govuk::LINK_BUTTON.build(obj! {
        "text": "Continue where you left off",
        "href": "/forge-developer-guide/patterns/demos/resuming?resume=true",
        "visibleWhen": has_saved_progress().clone(),
    })
}

pub fn start_button() -> Value {
    govuk::LINK_BUTTON.build(obj! {
        "text": "Start the pattern",
        "href": "/forge-developer-guide/patterns/demos/resuming/your-name",
        "isStartButton": true,
        "visibleWhen": not(has_saved_progress().clone()),
    })
}

pub fn scenarios_heading() -> Value {
    govuk::HEADING.build(obj! { "text": "Try different resume states", "size": "s" })
}

pub fn seed_partial_button() -> Value {
    govuk::BUTTON.build(obj! {
        "text": "Seed partial progress",
        "name": "action",
        "value": "seed-partial",
        "classes": "govuk-button--secondary",
    })
}

pub fn seed_complete_button() -> Value {
    govuk::BUTTON.build(obj! {
        "text": "Seed complete progress",
        "name": "action",
        "value": "seed-complete",
        "classes": "govuk-button--secondary",
    })
}

pub fn clear_button() -> Value {
    govuk::BUTTON.build(obj! {
        "text": "Clear saved answers",
        "name": "action",
        "value": "clear",
        "classes": "govuk-button--warning",
    })
}
