use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;
use forge_govuk_components::classes;
use forge_govuk_components::validations;

pub fn date_of_birth_field() -> Value {
    govuk::DATE_INPUT_FULL.build(obj! {
        "code": "dateOfBirth",
        "fieldset": obj! {
            "legend": obj! {
                "text": "What is your date of birth?",
                "classes": classes::fieldset::LARGE_LABEL,
                "isPageHeading": true,
            },
        },
        "hint": obj! { "text": "For example, 27 3 1990" },
        "validWhen": concat([
            validations::date_input_full(obj! {
                "empty": obj! { "message": "Enter your date of birth" },
                "missingDay": obj! { "message": "Date of birth must include a day" },
                "missingMonth": obj! { "message": "Date of birth must include a month" },
                "missingYear": obj! { "message": "Date of birth must include a year" },
                "invalid": obj! { "message": "Date of birth must be a real date" },
                "mustBePast": obj! { "message": "Date of birth must be in the past", "submissionOnly": true },
            }),
        ]),
    })
}

pub fn continue_button() -> Value {
    govuk::BUTTON.build(obj! { "text": "Continue" })
}
