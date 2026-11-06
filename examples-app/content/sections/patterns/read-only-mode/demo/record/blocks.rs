use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;
use forge_govuk_components::classes;

pub fn is_admin() -> Value {
    session("demoUser.role").matches(condition::equals("admin")).into()
}

pub fn is_viewer() -> Value {
    session("demoUser.role").matches(condition::equals("viewer")).into()
}

pub fn heading() -> Value {
    govuk::HEADING.build(obj! { "text": "Contact record", "size": "l" })
}

pub fn role_message() -> Value {
    govuk::BODY.build(obj! {
        "text": format("Signed in as %1 (%2).", [session("demoUser.name").into(), session("demoUser.role").into()]),
    })
}

pub fn viewer_notice() -> Value {
    govuk::INSET_TEXT.build(obj! {
        "text": "You have read-only access to this record.",
        "visibleWhen": is_viewer().clone(),
    })
}

pub fn summary_list() -> Value {
    govuk::SUMMARY_LIST.build(obj! {
        "rows": [
            obj! {
                "key": obj! { "text": "Name" },
                "value": obj! { "text": answer("recordName") },
            },
            obj! {
                "key": obj! { "text": "Email" },
                "value": obj! { "text": answer("recordEmail") },
            },
            obj! {
                "key": obj! { "text": "Department" },
                "value": obj! { "text": answer("recordDepartment") },
            },
        ],
        "visibleWhen": is_viewer().clone(),
    })
}

pub fn edit_heading() -> Value {
    govuk::HEADING.build(obj! {
        "text": "Edit record",
        "size": "m",
        "visibleWhen": is_admin().clone(),
    })
}

pub fn name_field() -> Value {
    govuk::TEXT_INPUT.build(obj! {
        "code": "recordName",
        "label": obj! { "text": "Name" },
        "classes": classes::input::WIDTH_20,
        "formatters": [transformer::string::trim()],
        "visibleWhen": is_admin().clone(),
        "validWhen": [
            validation(obj! {
                "condition": self_().matches(condition::is_required()),
                "message": "Enter a name",
            }),
        ],
    })
}

pub fn email_field() -> Value {
    govuk::TEXT_INPUT.build(obj! {
        "code": "recordEmail",
        "label": obj! { "text": "Email" },
        "classes": classes::input::WIDTH_20,
        "visibleWhen": is_admin().clone(),
        "validWhen": [
            validation(obj! {
                "condition": self_().matches(condition::is_required()),
                "message": "Enter an email address",
            }),
        ],
    })
}

pub fn department_field() -> Value {
    govuk::TEXT_INPUT.build(obj! {
        "code": "recordDepartment",
        "label": obj! { "text": "Department" },
        "classes": classes::input::WIDTH_20,
        "visibleWhen": is_admin().clone(),
        "validWhen": [
            validation(obj! {
                "condition": self_().matches(condition::is_required()),
                "message": "Enter a department",
            }),
        ],
    })
}

pub fn save_button() -> Value {
    govuk::BUTTON.build(obj! {
        "text": "Save changes",
        "visibleWhen": is_admin().clone(),
    })
}

pub fn back_button() -> Value {
    govuk::LINK_BUTTON.build(obj! {
        "text": "Back to contacts",
        "href": "/forge-developer-guide/patterns/demos/read-only-mode/contacts",
        "classes": "govuk-button--secondary",
    })
}
