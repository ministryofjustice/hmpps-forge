use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::blocks::{heading, intro, admin_button, viewer_button};

pub fn login_step() -> Value {
    step(obj! {
        "code": "login",
        "path": "/login",
        "title": "Log in",
        "reachability": obj! { "entryWhen": true },
        "blocks": [heading(), intro(), admin_button(), viewer_button()],
        "onSubmission": [
            submit(obj! {
                "when": post("action").matches(condition::equals("login-admin")),
                "validate": false,
                "onAlways": obj! {
                    "effects": [effect::call("SimulateLogin", vec!["Demo Admin".into(), "admin".into()])],
                    "next": [redirect(obj! { "goto": "dashboard" })],
                },
            }),
            submit(obj! {
                "when": post("action").matches(condition::equals("login-viewer")),
                "validate": false,
                "onAlways": obj! {
                    "effects": [effect::call("SimulateLogin", vec!["Demo Viewer".into(), "viewer".into()])],
                    "next": [redirect(obj! { "goto": "dashboard" })],
                },
            }),
        ],
    })
}
