use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::blocks::{contact_preference_field, continue_button};

pub fn contact_preference_step() -> Value {
    step(obj! {
        "code": "contact-preference",
        "path": "/contact-preference",
        "title": "How would you prefer to be contacted?",
        "reachability": obj! { "entryWhen": true },
        "blocks": [contact_preference_field(), continue_button()],
        "onSubmission": [
            submit(obj! {
                "validate": true,
                "onValid": obj! {
                    "effects": [effect::call("SaveDraftAnswers", vec!["edit-and-return".into()])],
                    "next": [
                        redirect(obj! {
                            "when": query("returnTo").matches(condition::equals("check-answers")),
                            "goto": "check-answers",
                        }),
                        redirect(obj! { "goto": "check-answers" }),
                    ],
                },
            }),
        ],
    })
}
