use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::blocks::{heading, address_line1_field, address_line2_field, address_town_field, address_postcode_field, continue_button};

// All four fields on one step, one validation pass, one save. Every missing or
// invalid field's message surfaces together in the error summary.
pub fn address_step() -> Value {
    step(obj! {
        "code": "address",
        "path": "/address",
        "title": "What is your address?",
        "blocks": [
            heading(),
            address_line1_field(),
            address_line2_field(),
            address_town_field(),
            address_postcode_field(),
            continue_button(),
        ],
        "onSubmission": [
            submit(obj! {
                "validate": true,
                "onValid": obj! {
                    "effects": [effect::call("SaveDraftAnswers", vec!["composite-fields".into()])],
                    "next": [redirect(obj! { "goto": "check-answers" })],
                },
            }),
        ],
    })
}
