use forge_core::authoring::*;
use forge_core::{Value, obj};
use super::blocks::{heading, intro, agree_plan_field, button_group};

pub fn agree_plan_step() -> Value {
    step(obj! {
        "code": "agree-plan",
        "path": "/agree-plan",
        "title": "Agree sentence plan",
        "reachability": obj! { "entryWhen": true },
        "blocks": [heading(), intro(), agree_plan_field(), button_group()],
        "onSubmission": [
            submit(obj! {
                "validate": true,
                "onValid": obj! {
                    "effects": [
                        effect::call("SaveDraftAnswers", vec!["collection-validation".into()]),
                        effect::call("SaveSubmitStateToSession", vec!["collection-validation".into(), true.into()]),
                    ],
                    "next": [redirect(obj! { "goto": "confirmation" })],
                },
            }),
        ],
    })
}
