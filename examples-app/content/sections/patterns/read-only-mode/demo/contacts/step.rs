use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::super::guards::require_auth;
use super::blocks::{heading, role_message, contacts_list, logout_button};

pub fn contacts_step() -> Value {
    step(obj! {
        "code": "contacts",
        "path": "/contacts",
        "title": "Contacts",
        "reachability": obj! { "entryWhen": true },
        "onAccess": [require_auth()],
        "blocks": [heading(), role_message(), contacts_list(), logout_button()],
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
