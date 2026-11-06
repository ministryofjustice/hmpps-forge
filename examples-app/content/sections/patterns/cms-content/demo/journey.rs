use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::overview::step::overview_step;
use super::write::step::write_step;
use super::posts::step::posts_step;

pub fn cms_content_demo_journey() -> Value {
    journey(obj! {
        "code": "cms-content-demo",
        "title": "CMS content",
        "path": "/cms-content",
        "onAccess": [
            access(obj! {
                "effects": [effect::call("LoadBlogPosts", vec![])],
            }),
        ],
        "steps": [overview_step(), write_step(), posts_step()],
    })
}
