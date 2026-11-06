use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::overview::step::overview_step;
use super::login::step::login_step;
use super::dashboard::step::dashboard_step;
use super::admin_panel::step::admin_panel_step;

pub fn auth_role_demo_journey() -> Value {
    journey(obj! {
        "code": "auth-role-demo",
        "title": "Require authentication / role",
        "path": "/auth-role",
        "steps": [overview_step(), login_step(), dashboard_step(), admin_panel_step()],
    })
}
