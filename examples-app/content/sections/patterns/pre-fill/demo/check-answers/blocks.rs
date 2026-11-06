use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

pub fn heading() -> Value {
    govuk::HEADING.build(obj! {
        "text": "Check your answers",
    })
}

pub fn summary_list() -> Value {
    govuk::SUMMARY_LIST.build(obj! {
        "rows": [
            obj! {
                "key": obj! { "text": "Address line 1" },
                "value": obj! { "text": answer("addressLine1") },
                "actions": obj! {
                    "items": [
                        obj! {
                            "href": "find-address",
                            "text": "Change",
                            "visuallyHiddenText": "address line 1",
                        },
                    ],
                },
            },
            obj! {
                "key": obj! { "text": "Address line 2" },
                "value": obj! { "text": answer("addressLine2") },
                "actions": obj! {
                    "items": [
                        obj! {
                            "href": "find-address",
                            "text": "Change",
                            "visuallyHiddenText": "address line 2",
                        },
                    ],
                },
            },
            obj! {
                "key": obj! { "text": "Town or city" },
                "value": obj! { "text": answer("addressTown") },
                "actions": obj! {
                    "items": [
                        obj! {
                            "href": "find-address",
                            "text": "Change",
                            "visuallyHiddenText": "town or city",
                        },
                    ],
                },
            },
            obj! {
                "key": obj! { "text": "County" },
                "value": obj! { "text": answer("addressCounty") },
                "actions": obj! {
                    "items": [
                        obj! {
                            "href": "find-address",
                            "text": "Change",
                            "visuallyHiddenText": "county",
                        },
                    ],
                },
            },
            obj! {
                "key": obj! { "text": "Postcode" },
                "value": obj! { "text": answer("addressPostcode") },
                "actions": obj! {
                    "items": [
                        obj! {
                            "href": "find-address",
                            "text": "Change",
                            "visuallyHiddenText": "postcode",
                        },
                    ],
                },
            },
        ],
    })
}

pub fn confirm_body() -> Value {
    govuk::BODY.build(obj! {
        "text": "Selecting \"Confirm\" will save your answers.",
    })
}

pub fn submit_button() -> Value {
    govuk::BUTTON.build(obj! { "text": "Confirm" })
}
