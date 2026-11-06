use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;
use forge_govuk_components::classes;

// Each radio item can carry a `block` that the GOV.UK radios template renders
// inside a conditional reveal. Nested fields use `dependentWhen` so their value
// and validation only apply when the parent option is the selected answer - if
// the user picks a different option, the reveal's input is ignored even if a
// stale value exists in the session.
pub fn heard_from_field() -> Value {
    govuk::RADIO_INPUT.build(obj! {
        "code": "heardFrom",
        "fieldset": obj! {
            "legend": obj! {
                "text": "How did you hear about us?",
                "classes": classes::fieldset::LARGE_LABEL,
                "isPageHeading": true,
            },
        },
        "items": [
            obj! { "value": "search-engine", "text": "Search engine" },
            obj! {
                "value": "social-media",
                "text": "Social media",
                "block": govuk::TEXT_INPUT.build(obj! {
                    "code": "socialMediaSource",
                    "label": "Which platform?",
                    "dependentWhen": answer("heardFrom").matches(condition::equals("social-media")),
                    "classes": classes::input::WIDTH_20,
                    "formatters": [transformer::string::trim()],
                    "validWhen": [
                        validation(obj! {
                            "condition": self_().matches(condition::is_required()),
                            "message": "Enter the platform where you saw us",
                        }),
                    ],
                }),
            },
            obj! { "value": "friend-or-colleague", "text": "Friend or colleague" },
            obj! {
                "value": "other",
                "text": "Other",
                "block": govuk::TEXT_INPUT.build(obj! {
                    "code": "otherSource",
                    "label": "Please specify",
                    "dependentWhen": answer("heardFrom").matches(condition::equals("other")),
                    "classes": classes::input::WIDTH_20,
                    "formatters": [transformer::string::trim()],
                    "validWhen": [
                        validation(obj! {
                            "condition": self_().matches(condition::is_required()),
                            "message": "Enter where you heard about us",
                        }),
                    ],
                }),
            },
        ],
        "validWhen": [
            validation(obj! {
                "condition": self_().matches(condition::is_required()),
                "message": "Select how you heard about us",
            }),
        ],
    })
}

pub fn continue_button() -> Value {
    govuk::BUTTON.build(obj! { "text": "Continue" })
}
