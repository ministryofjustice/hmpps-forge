//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/read-only-mode/demo/record/blocks.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;


fn is_admin() -> D {
    session("demoUser.role").matches(condition::equals("admin"))
}

fn is_viewer() -> D {
    session("demoUser.role").matches(condition::equals("viewer"))
}

pub fn heading() -> D {
    component(&govuk::HEADING, obj! { "text": "Contact record", "size": "l" })
}

pub fn role_message() -> D {
    component(&govuk::BODY, obj! {
        "text": format("Signed in as %1 (%2).", vec![session("demoUser.name"), session("demoUser.role")]),
    })
}

pub fn viewer_notice() -> D {
    component(&govuk::INSET_TEXT, obj! { "text": "You have read-only access to this record.", "visibleWhen": is_viewer() })
}

pub fn summary_list() -> D {
    component(&govuk::SUMMARY_LIST, obj! {
        "rows": arr![
            obj! { "key": obj! { "text": "Name" }, "value": obj! { "text": answer("recordName") } },
            obj! {
                "key": obj! { "text": "Email" },
                "value": obj! { "text": answer("recordEmail") },
            },
            obj! {
                "key": obj! { "text": "Department" },
                "value": obj! { "text": answer("recordDepartment") },
            },
        ],
        "visibleWhen": is_viewer(),
    })
}

pub fn edit_heading() -> D {
    component(&govuk::HEADING, obj! { "text": "Edit record", "size": "m", "visibleWhen": is_admin() })
}

pub fn name_field() -> D {
    component(&govuk::TEXT_INPUT, obj! {
        "code": "recordName",
        "label": obj! { "text": "Name" },
        "classes": D::from(forge_govuk_components::utility_classes()).get("Input").get("Width20"),
        "formatters": arr![transformer::string::trim()],
        "visibleWhen": is_admin(),
        "validWhen": arr![validation(obj! { "condition": self_().matches(condition::is_required()), "message": "Enter a name" })],
    })
}

pub fn email_field() -> D {
    component(&govuk::TEXT_INPUT, obj! {
        "code": "recordEmail",
        "label": obj! { "text": "Email" },
        "classes": D::from(forge_govuk_components::utility_classes()).get("Input").get("Width20"),
        "visibleWhen": is_admin(),
        "validWhen": arr![validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Enter an email address",
        })],
    })
}

pub fn department_field() -> D {
    component(&govuk::TEXT_INPUT, obj! {
        "code": "recordDepartment",
        "label": obj! { "text": "Department" },
        "classes": D::from(forge_govuk_components::utility_classes()).get("Input").get("Width20"),
        "visibleWhen": is_admin(),
        "validWhen": arr![validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Enter a department",
        })],
    })
}

pub fn save_button() -> D {
    component(&govuk::BUTTON, obj! { "text": "Save changes", "visibleWhen": is_admin() })
}

pub fn back_button() -> D {
    component(&govuk::LINK_BUTTON, obj! {
        "text": "Back to contacts",
        "href": "/forge-developer-guide/patterns/demos/read-only-mode/contacts",
        "classes": "govuk-button--secondary",
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        let _ = is_admin();
        let _ = is_viewer();
        let _ = heading();
        let _ = role_message();
        let _ = viewer_notice();
        let _ = summary_list();
        let _ = edit_heading();
        let _ = name_field();
        let _ = email_field();
        let _ = department_field();
        let _ = save_button();
        let _ = back_button();
    });
}
