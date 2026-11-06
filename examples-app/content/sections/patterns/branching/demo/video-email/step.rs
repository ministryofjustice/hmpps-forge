use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::blocks::{video_email_field, continue_button};

// Branch step for the video path — only reachable when visitType is 'video'.
// All branches converge on check-answers after collecting their details.
pub fn video_email_step() -> Value {
    step(obj! {
        "code": "video-email",
        "path": "/video-email",
        "title": "What email should we send the invite to?",
        "blocks": [video_email_field(), continue_button()],
        "onSubmission": [
            submit(obj! {
                "validate": true,
                "onValid": obj! {
                    "effects": [effect::call("SaveDraftAnswers", vec!["branching".into()])],
                    "next": [redirect(obj! { "goto": "check-answers" })],
                },
            }),
        ],
    })
}
