use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::super::guards::require_auth;
use super::blocks::{heading, body, back_link};

pub fn admin_panel_step() -> Value {
    step(obj! {
        "code": "admin-panel",
        "path": "/admin-panel",
        "title": "Admin panel",
        "reachability": obj! { "entryWhen": true },
        "onAccess": [
            require_auth(),
            access(obj! {
                "next": [
                    throw_error(obj! {
                        "when": session("demoUser.role").not().matches(condition::equals("admin")),
                        "status": 403,
                        "message": "You do not have permission to access this page",
                    }),
                ],
            }),
        ],
        "blocks": [heading(), body(), back_link()],
    })
}
