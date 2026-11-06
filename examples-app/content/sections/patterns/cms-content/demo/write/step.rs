use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::blocks::{heading, title_input, body_editor, publish_button};

pub fn write_step() -> Value {
    step(obj! {
        "code": "write",
        "path": "/write",
        "title": "Write a post",
        "reachability": obj! { "entryWhen": true },
        "blocks": [heading(), title_input(), body_editor(), publish_button()],
        "onSubmission": [
            submit(obj! {
                "validate": true,
                "onValid": obj! {
                    "effects": [effect::call("SaveBlogPost", vec![])],
                    "next": [redirect(obj! { "goto": "posts" })],
                },
            }),
        ],
    })
}
