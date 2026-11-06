use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

pub fn heading() -> Value {
    govuk::HEADING.build(obj! { "text": "Admin panel", "size": "l" })
}

pub fn body() -> Value {
    govuk::BODY.build(obj! {
        "text": "This page is only accessible to users with the admin role. Viewers who try to access it receive a 403 error.",
    })
}

pub fn back_link() -> Value {
    govuk::LINK_BUTTON.build(obj! {
        "text": "Back to dashboard",
        "href": "/forge-developer-guide/patterns/demos/auth-role/dashboard",
        "classes": "govuk-button--secondary",
    })
}
