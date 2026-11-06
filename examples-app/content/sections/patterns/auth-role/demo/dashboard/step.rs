use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::super::guards::require_auth;
use super::blocks::{heading, welcome_message, viewer_warning, admin_link, logout_button};

pub fn dashboard_step() -> Value {
    step(obj! {
        "code": "dashboard",
        "path": "/dashboard",
        "title": "Dashboard",
        "reachability": obj! { "entryWhen": true },
        "onAccess": [require_auth()],
        "blocks": [heading(), welcome_message(), viewer_warning(), admin_link(), logout_button()],
        "onSubmission": [
            submit(obj! {
                "when": post("action").matches(condition::equals("logout")),
                "validate": false,
                "onAlways": obj! {
                    "effects": [effect::call("SimulateLogout", vec![])],
                    "next": [redirect(obj! { "goto": "login" })],
                },
            }),
        ],
    })
}
