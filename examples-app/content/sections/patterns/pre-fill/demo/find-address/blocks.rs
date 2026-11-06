use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;
use forge_govuk_components::classes;

pub fn heading() -> Value {
    govuk::HEADING.build(obj! {
        "text": "Find an address",
        "size": "l",
    })
}

pub fn postcode_field() -> Value {
    govuk::TEXT_INPUT.build(obj! {
        "code": "postcode",
        "label": obj! { "text": "Postcode" },
        "hint": obj! { "text": "Try SW1A 1AA, SW1A 2AA, or LS1 2BJ" },
        "classes": classes::input::WIDTH_10,
        "formatters": [transformer::string::trim()],
        "validWhen": [
            validation(obj! {
                "condition": self_().matches(condition::is_required()),
                "message": "Enter a postcode",
                "submissionOnly": true,
                "groups": ["find-postcode"],
            }),
            validation(obj! {
                "condition": or(vec![not(self_().matches(condition::is_required())), self_().matches(condition::address::is_valid_postcode())]),
                "message": "Enter a valid postcode",
                "submissionOnly": true,
                "groups": ["find-postcode"],
            }),
        ],
    })
}

pub fn find_address_button() -> Value {
    govuk::BUTTON.build(obj! {
        "text": "Find address",
        "name": "action",
        "value": "find-address",
        "classes": "govuk-button--secondary",
    })
}

pub fn address_line1_field() -> Value {
    govuk::TEXT_INPUT.build(obj! {
        "code": "addressLine1",
        "label": obj! { "text": "Address line 1" },
        "autocomplete": "address-line1",
        "validWhen": [
            validation(obj! {
                "condition": self_().matches(condition::is_required()),
                "message": "Enter address line 1",
                "groups": ["address"],
            }),
        ],
    })
}

pub fn address_line2_field() -> Value {
    govuk::TEXT_INPUT.build(obj! {
        "code": "addressLine2",
        "label": obj! { "text": "Address line 2 (optional)" },
        "autocomplete": "address-line2",
    })
}

pub fn address_town_field() -> Value {
    govuk::TEXT_INPUT.build(obj! {
        "code": "addressTown",
        "label": obj! { "text": "Town or city" },
        "autocomplete": "address-level2",
        "classes": classes::input::WIDTH_20,
        "validWhen": [
            validation(obj! {
                "condition": self_().matches(condition::is_required()),
                "message": "Enter a town or city",
                "groups": ["address"],
            }),
        ],
    })
}

pub fn address_county_field() -> Value {
    govuk::TEXT_INPUT.build(obj! {
        "code": "addressCounty",
        "label": obj! { "text": "County (optional)" },
        "classes": classes::input::WIDTH_20,
    })
}

pub fn address_postcode_field() -> Value {
    govuk::TEXT_INPUT.build(obj! {
        "code": "addressPostcode",
        "label": obj! { "text": "Postcode" },
        "autocomplete": "postal-code",
        "classes": classes::input::WIDTH_10,
        "validWhen": [
            validation(obj! {
                "condition": self_().matches(condition::is_required()),
                "message": "Enter a postcode",
                "groups": ["address"],
            }),
        ],
    })
}

pub fn button_group() -> Value {
    govuk::BUTTON_GROUP.build(obj! {
        "buttons": [
            govuk::BUTTON.build(obj! {
                "text": "Continue",
                "name": "action",
                "value": "continue",
            }),
        ],
    })
}
