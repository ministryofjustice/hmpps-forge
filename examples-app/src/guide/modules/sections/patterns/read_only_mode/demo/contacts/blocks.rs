//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/read-only-mode/demo/contacts/blocks.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;


pub fn heading() -> D {
    component(&govuk::HEADING, obj! { "text": "Contacts", "size": "l" })
}

pub fn role_message() -> D {
    component(&govuk::BODY, obj! {
        "text": format("Signed in as %1 (%2).", vec![session("demoUser.name"), session("demoUser.role")]),
    })
}

pub fn contacts_list() -> D {
    component(&govuk::SUMMARY_LIST, obj! {
        "rows": arr![
            obj! {
                "key": obj! { "text": answer("contacts.0.recordName") },
                "value": obj! { "text": answer("contacts.0.recordEmail") },
                "actions": obj! { "items": arr![obj! { "href": "record/0", "text": "View" }] },
            },
            obj! {
                "key": obj! { "text": answer("contacts.1.recordName") },
                "value": obj! { "text": answer("contacts.1.recordEmail") },
                "actions": obj! { "items": arr![obj! { "href": "record/1", "text": "View" }] },
            },
            obj! {
                "key": obj! { "text": answer("contacts.2.recordName") },
                "value": obj! { "text": answer("contacts.2.recordEmail") },
                "actions": obj! { "items": arr![obj! { "href": "record/2", "text": "View" }] },
            },
        ],
    })
}

pub fn logout_button() -> D {
    component(&govuk::BUTTON, obj! {
        "text": "Log out",
        "name": "action",
        "value": "logout",
        "classes": "govuk-button--secondary",
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        let _ = heading();
        let _ = role_message();
        let _ = contacts_list();
        let _ = logout_button();
    });
}
