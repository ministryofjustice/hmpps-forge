use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::blocks::{visit_type_field, continue_button};

// The branching happens here. After saving, the next[] array is evaluated in
// order: the first redirect whose `when` matches wins. Only one of them will
// fire per submit.
pub fn visit_type_step() -> Value {
    step(obj! {
        "code": "visit-type",
        "path": "/visit-type",
        "title": "How would you like to meet?",
        "reachability": obj! { "entryWhen": true },
        "blocks": [visit_type_field(), continue_button()],
        "onSubmission": [
            submit(obj! {
                "validate": true,
                "onValid": obj! {
                    "effects": [effect::call("SaveDraftAnswers", vec!["branching".into()])],
                    "next": [
                        redirect(obj! {
                            "when": answer("visitType").matches(condition::equals("in-person")),
                            "goto": "location",
                        }),
                        redirect(obj! {
                            "when": answer("visitType").matches(condition::equals("video")),
                            "goto": "video-email",
                        }),
                        redirect(obj! {
                            "when": answer("visitType").matches(condition::equals("phone")),
                            "goto": "phone-number",
                        }),
                    ],
                },
            }),
        ],
    })
}
