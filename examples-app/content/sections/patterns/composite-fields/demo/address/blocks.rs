use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;
use forge_govuk_components::classes;

// This is the author-owned flavour of composite field. There is no single
// GovUKAddressInput component - the author lays out separate fields on one
// step and composes them on the summary page. Each field is standalone from
// Forge's point of view, which means each one gets its own answer, its own
// validation, and its own change link if needed.
pub fn heading() -> Value {
    govuk::HEADING.build(obj! { "text": "What is your address?" })
}

pub fn address_line1_field() -> Value {
    govuk::TEXT_INPUT.build(obj! {
        "code": "addressLine1",
        "label": obj! {
            "text": "Address line 1",
            "classes": classes::label::MEDIUM,
        },
        "classes": classes::input::WIDTH_30,
        "autocomplete": "address-line1",
        "formatters": [transformer::string::trim()],
        "validWhen": [
            validation(obj! {
                "condition": self_().matches(condition::is_required()),
                "message": "Enter the first line of your address",
            }),
        ],
    })
}

// Line 2 is optional. No validation means an empty value is accepted, and the
// summary page decides whether to show it based on whether the user filled it in.
pub fn address_line2_field() -> Value {
    govuk::TEXT_INPUT.build(obj! {
        "code": "addressLine2",
        "label": obj! {
            "text": "Address line 2 (optional)",
            "classes": classes::label::MEDIUM,
        },
        "classes": classes::input::WIDTH_30,
        "autocomplete": "address-line2",
        "formatters": [transformer::string::trim()],
    })
}

pub fn address_town_field() -> Value {
    govuk::TEXT_INPUT.build(obj! {
        "code": "addressTown",
        "label": obj! {
            "text": "Town or city",
            "classes": classes::label::MEDIUM,
        },
        "classes": classes::input::WIDTH_20,
        "autocomplete": "address-level2",
        "formatters": [transformer::string::trim()],
        "validWhen": [
            validation(obj! {
                "condition": self_().matches(condition::is_required()),
                "message": "Enter your town or city",
            }),
        ],
    })
}

// Postcode has 2 validation rules: required, and a format check. The ordering
// matters - required runs first so a blank value triggers "Enter your postcode"
// rather than "Enter a valid postcode". Values are also upper-cased so stored
// answers are consistent.
pub fn address_postcode_field() -> Value {
    govuk::TEXT_INPUT.build(obj! {
        "code": "addressPostcode",
        "label": obj! {
            "text": "Postcode",
            "classes": classes::label::MEDIUM,
        },
        "classes": classes::input::WIDTH_10,
        "autocomplete": "postal-code",
        "formatters": [transformer::string::trim(), transformer::string::to_upper_case()],
        "validWhen": [
            validation(obj! {
                "condition": self_().matches(condition::is_required()),
                "message": "Enter your postcode",
            }),
            validation(obj! {
                "condition": self_().matches(condition::address::is_valid_postcode()),
                "message": "Enter a real postcode",
            }),
        ],
    })
}

pub fn continue_button() -> Value {
    govuk::BUTTON.build(obj! { "text": "Continue" })
}
