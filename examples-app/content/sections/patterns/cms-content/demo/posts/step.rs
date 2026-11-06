use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::blocks::{heading, post_count, write_button, posts_list, empty_state};

pub fn posts_step() -> Value {
    step(obj! {
        "code": "posts",
        "path": "/posts",
        "title": "Blog posts",
        "reachability": obj! { "entryWhen": true },
        "onAccess": [
            access(obj! {
                "effects": [effect::call("LoadBlogPosts", vec![])],
            }),
        ],
        "blocks": [heading(), post_count(), write_button(), posts_list(), empty_state()],
    })
}
