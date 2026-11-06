use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::blocks::{email_field, continue_button};

pub fn email_address_step() -> Value {
    step(obj! {
        "code": "email-address",
        "path": "/email-address",
        "title": "What is your email address?",
        "reachability": obj! { "entryWhen": true },
        "blocks": [email_field(), continue_button()],
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
                        redirect(obj! { "goto": "contact-preference" }),
                    ],
                },
            }),
        ],
    })
}
