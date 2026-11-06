use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

pub fn heading() -> Value {
    govuk::HEADING.build(obj! { "text": "Dashboard", "size": "l" })
}

pub fn welcome_message() -> Value {
    govuk::BODY.build(obj! {
        "text": format("Signed in as %1 (role: %2).", [session("demoUser.name").into(), session("demoUser.role").into()]),
    })
}

pub fn viewer_warning() -> Value {
    govuk::INSET_TEXT.build(obj! {
        "text": "You are signed in as a viewer. The admin panel will return a raw 403 error page. Use your browser's back button to return here.",
        "visibleWhen": session("demoUser.role").matches(condition::equals("viewer")),
    })
}

pub fn admin_link() -> Value {
    govuk::LINK_BUTTON.build(obj! {
        "text": "Go to admin panel",
        "href": "/forge-developer-guide/patterns/demos/auth-role/admin-panel",
    })
}

pub fn logout_button() -> Value {
    govuk::BUTTON.build(obj! {
        "text": "Log out",
        "name": "action",
        "value": "logout",
        "classes": "govuk-button--secondary",
    })
}
