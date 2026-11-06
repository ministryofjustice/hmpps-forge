use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::blocks::{heading, member_rows, button_group};

const PATTERN_CODE: &str = "repeating-fieldsets";

const COLLECTION_CODE: &str = "members";

const FIELD_CODES: [&str; 2] = ["memberName", "memberAge"];

pub fn household_members_step() -> Value {
    step(obj! {
        "code": "household-members",
        "path": "/household-members",
        "title": "Household members",
        "reachability": obj! { "entryWhen": true },
        "blocks": [heading(), member_rows(), button_group()],
        "onAccess": [
            access(obj! {
                "effects": [
                    effect::call("InitializeRepeatingFieldsets", vec![PATTERN_CODE.into(), COLLECTION_CODE.into(), FIELD_CODES.into()]),
                ],
            }),
        ],
        "onSubmission": [
            submit(obj! {
                "when": post("action").matches(condition::equals("add-another")),
                "validate": false,
                "onAlways": obj! {
                    "effects": [
                        effect::call("AddRepeatingItem", vec![PATTERN_CODE.into(), COLLECTION_CODE.into(), FIELD_CODES.into()]),
                    ],
                },
            }),
            submit(obj! {
                "when": post("action").matches(condition::string::starts_with("remove_")),
                "validate": false,
                "onAlways": obj! {
                    "effects": [
                        effect::call("RemoveRepeatingItem", vec![PATTERN_CODE.into(), COLLECTION_CODE.into(), FIELD_CODES.into()]),
                    ],
                },
            }),
            submit(obj! {
                "when": post("action").matches(condition::equals("continue")),
                "validate": true,
                "onValid": obj! {
                    "effects": [
                        effect::call("SaveRepeatingItems", vec![PATTERN_CODE.into(), COLLECTION_CODE.into(), FIELD_CODES.into()]),
                    ],
                    "next": [redirect(obj! { "goto": "check-answers" })],
                },
            }),
        ],
        // Step-level validation — requires at least one contact before the user
        // can continue. Also feeds into reachability: downstream steps are
        // unreachable while this rule fails.
        "validWhen": [
            validation(obj! {
                "condition": data("members").matches(condition::is_required()),
                "message": "Add at least one household member",
            }),
        ],
    })
}
