use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::blocks::{heading, intro, admin_button, viewer_button};

pub fn seed_contacts() -> Value {
    effect::call("SeedDraftAnswers", vec!["read-only-mode".into(), obj! {
        "contacts": [
            obj! {
                "recordName": "Jane Smith",
                "recordEmail": "jane.smith@example.com",
                "recordDepartment": "Digital Services",
            },
            obj! {
                "recordName": "John Doe",
                "recordEmail": "john.doe@example.com",
                "recordDepartment": "Policy",
            },
            obj! {
                "recordName": "Sarah Wilson",
                "recordEmail": "sarah.wilson@example.com",
                "recordDepartment": "Operations",
            },
        ],
    }]).into()
}

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
                    "effects": [effect::call("SimulateLogin", vec!["Demo Admin".into(), "admin".into()]), seed_contacts().clone()],
                    "next": [redirect(obj! { "goto": "contacts" })],
                },
            }),
            submit(obj! {
                "when": post("action").matches(condition::equals("login-viewer")),
                "validate": false,
                "onAlways": obj! {
                    "effects": [effect::call("SimulateLogin", vec!["Demo Viewer".into(), "viewer".into()]), seed_contacts().clone()],
                    "next": [redirect(obj! { "goto": "contacts" })],
                },
            }),
        ],
    })
}
