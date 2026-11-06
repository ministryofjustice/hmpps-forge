use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

pub fn heading() -> Value {
    govuk::HEADING.build(obj! {
        "text": "Check your answers",
    })
}

// Date of birth comes out of GovUKDateInputFull as an ISO string. ToDate() parses
// it and Transformer.Date.Format renders a friendly long-date for display. The
// underlying answer is untouched - the transform happens at render time.
pub fn date_of_birth_display() -> Value {
    answer("dateOfBirth").pipe([transformer::string::to_date(), transformer::date::format("D MMMM YYYY")]).into()
}

// The address is 4 separate answers that the author composes here.
// NunjucksGenerators.String renders a small template with autoescape on, so
// {{ line1 }} etc. are HTML-escaped automatically and the optional line 2 is
// gated with a plain {% if %}. Forge evaluates the Answer() references in
// `data` before the template runs, so the template just sees strings.
pub fn address_display() -> Value {
    generator::call("String", vec![obj! {
        "template": "\n    {{ line1 }}<br>\n    {% if line2 %}{{ line2 }}<br>{% endif %}\n    {{ town }}<br>\n    {{ postcode }}\n  ",
        "data": obj! {
            "line1": answer("addressLine1"),
            "line2": answer("addressLine2"),
            "town": answer("addressTown"),
            "postcode": answer("addressPostcode"),
        },
    }]).into()
}

pub fn summary_list() -> Value {
    govuk::SUMMARY_LIST.build(obj! {
        "rows": [
            obj! {
                "key": obj! { "text": "Date of birth" },
                "value": obj! { "text": date_of_birth_display() },
                "actions": obj! {
                    "items": [
                        obj! {
                            "href": "date-of-birth",
                            "text": "Change",
                            "visuallyHiddenText": "date of birth",
                        },
                    ],
                },
            },
            obj! {
                "key": obj! { "text": "Address" },
                "value": obj! { "html": address_display() },
                "actions": obj! {
                    "items": [obj! { "href": "address", "text": "Change", "visuallyHiddenText": "address" }],
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
