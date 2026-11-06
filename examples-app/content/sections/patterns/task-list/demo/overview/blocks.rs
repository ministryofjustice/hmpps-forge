use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

pub fn heading() -> Value {
    govuk::HEADING.build(obj! {
        "text": "Task list",
        "size": "l",
        "caption": "Pattern",
    })
}

pub fn intro() -> Value {
    govuk::BODY.build(obj! {
        "text": "A hub page that breaks a complex service into named tasks,\n  each with a completion status. Users can complete tasks in any order\n  (subject to prerequisites) and return to the hub between sections.",
    })
}

pub fn shows() -> Value {
    govuk::HEADING.build(obj! { "text": "What this pattern shows", "size": "s" })
}

pub fn shows_list() -> Value {
    govuk::LIST.build(obj! {
        "items": literal([
            "A GovUKTaskList component with dynamic status tags per task",
            "Conditional hrefs that disable links when prerequisites are incomplete",
            "Status derived from answer state using nested Conditional expressions",
            "Each section redirects back to the task list after completion",
            "A gated \"Check and submit\" task that only unlocks when all others are done",
        ]),
        "style": "bullet",
    })
}

pub fn start_button() -> Value {
    govuk::LINK_BUTTON.build(obj! {
        "text": "Start the pattern",
        "href": "/forge-developer-guide/patterns/demos/task-list/tasks",
        "isStartButton": true,
    })
}
