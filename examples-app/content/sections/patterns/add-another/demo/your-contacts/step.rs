use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::blocks::{heading, contact_cards, button_group};

pub fn your_contacts_step() -> Value {
    step(obj! {
        "code": "your-contacts",
        "path": "/your-contacts",
        "title": "Your emergency contacts",
        "reachability": obj! { "entryWhen": true },
        "blocks": [heading(), contact_cards(), button_group()],
        // Step-level validation — requires at least one contact before the user
        // can continue. Also feeds into reachability: downstream steps are
        // unreachable while this rule fails.
        "validWhen": [
            validation(obj! {
                "condition": answer("contacts").matches(condition::is_required()),
                "message": "Add at least one emergency contact",
            }),
        ],
        "onSubmission": [
            // "Add another" skips validation so the user is never blocked from
            // adding their first contact when the collection is empty.
            submit(obj! {
                "when": post("action").matches(condition::equals("add-another")),
                "validate": false,
                "onAlways": obj! {
                    "effects": [effect::call("SaveDraftAnswers", vec!["add-another".into()])],
                    "next": [redirect(obj! { "goto": "add-contact" })],
                },
            }),
            // "Continue" validates — triggers the step-level validWhen rule above.
            submit(obj! {
                "when": post("action").matches(condition::equals("continue")),
                "validate": true,
                "onValid": obj! {
                    "next": [redirect(obj! { "goto": "check-answers" })],
                },
            }),
        ],
    })
}
