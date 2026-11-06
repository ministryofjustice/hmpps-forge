use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

pub fn heading() -> Value {
    govuk::HEADING.build(obj! { "text": "Log in", "size": "l" })
}

pub fn intro() -> Value {
    govuk::BODY.build(obj! {
        "text": "Pick a role to simulate logging in. Admins can edit the contact record. Viewers can only view it.",
    })
}

pub fn admin_button() -> Value {
    govuk::BUTTON.build(obj! {
        "text": "Log in as Admin",
        "name": "action",
        "value": "login-admin",
    })
}

pub fn viewer_button() -> Value {
    govuk::BUTTON.build(obj! {
        "text": "Log in as Viewer",
        "name": "action",
        "value": "login-viewer",
        "classes": "govuk-button--secondary",
    })
}
