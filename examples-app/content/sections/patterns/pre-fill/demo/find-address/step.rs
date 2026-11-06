use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::blocks::{heading, postcode_field, find_address_button, address_line1_field, address_line2_field, address_town_field, address_county_field, address_postcode_field, button_group};

pub fn find_address_step() -> Value {
    step(obj! {
        "code": "find-address",
        "path": "/find-address",
        "title": "Find an address",
        "reachability": obj! { "entryWhen": true },
        "blocks": [
            heading(),
            postcode_field(),
            find_address_button(),
            address_line1_field(),
            address_line2_field(),
            address_town_field(),
            address_county_field(),
            address_postcode_field(),
            button_group(),
        ],
        "onSubmission": [
            submit(obj! {
                "when": post("action").matches(condition::equals("find-address")),
                "validate": obj! { "groups": ["find-postcode"] },
                "onValid": obj! {
                    "effects": [effect::call("LookupAddress", vec![])],
                },
            }),
            submit(obj! {
                "when": post("action").matches(condition::equals("continue")),
                "validate": obj! { "groups": ["address"] },
                "onValid": obj! {
                    "effects": [effect::call("SaveDraftAnswers", vec!["pre-fill".into()])],
                    "next": [redirect(obj! { "goto": "check-answers" })],
                },
            }),
        ],
    })
}
