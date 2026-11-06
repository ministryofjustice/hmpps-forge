use forge_core::authoring::*;
use forge_core::{Value, obj};

pub fn require_auth() -> Value {
    access(obj! {
        "next": [
            redirect(obj! {
                "when": session("demoUser").not().matches(condition::is_required()),
                "goto": "login",
            }),
        ],
    })
}
