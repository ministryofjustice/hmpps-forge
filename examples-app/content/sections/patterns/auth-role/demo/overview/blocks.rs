use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

pub fn heading() -> Value {
    govuk::HEADING.build(obj! {
        "text": "Require authentication / role",
        "size": "l",
        "caption": "Pattern",
    })
}

pub fn intro() -> Value {
    govuk::BODY.build(obj! {
        "text": "A journey where some steps require the user to be authenticated and\n  others require a specific role. Unauthenticated users are redirected to\n  a login page. Users without the required role see a 403 error.",
    })
}

pub fn shows() -> Value {
    govuk::HEADING.build(obj! { "text": "What this pattern shows", "size": "s" })
}

pub fn shows_list() -> Value {
    govuk::LIST.build(obj! {
        "items": literal([
            "A reusable guard function that redirects unauthenticated users",
            "A step-level access hook that returns 403 for the wrong role",
            "Session() references in access hook conditions",
            "Composing multiple access hooks on a single step (auth + role)",
        ]),
        "style": "bullet",
    })
}

pub fn start_button() -> Value {
    govuk::LINK_BUTTON.build(obj! {
        "text": "Start the pattern",
        "href": "/forge-developer-guide/patterns/demos/auth-role/login",
        "isStartButton": true,
    })
}
