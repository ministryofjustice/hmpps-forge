use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;
use forge_govuk_components::classes;

pub fn heading() -> Value {
    govuk::HEADING.build(obj! {
        "text": "Agree sentence plan",
        "size": "l",
        "caption": "Collection validation demo",
    })
}

pub fn intro() -> Value {
    govuk::BODY.build(obj! {
        "text": "Review the plan below. You can only agree the plan when every\n  active goal has at least one action assigned to it.",
    })
}

pub fn agree_plan_field() -> Value {
    govuk::RADIO_INPUT.build(obj! {
        "code": "agreePlan",
        "fieldset": obj! {
            "legend": obj! {
                "text": "Do you agree this plan?",
                "classes": classes::fieldset::MEDIUM_LABEL,
            },
        },
        "items": [
            obj! { "value": "yes", "text": "Yes, I agree this plan" },
            obj! { "value": "no", "text": "No, I do not agree this plan" },
        ],
        "validWhen": [
            validation(obj! {
                "condition": self_().matches(condition::is_required()),
                "message": "Select whether you agree this plan",
            }),
            // There must be at least one active goal
            validation(obj! {
                "condition": data("goals").each(iterator::filter(item().path("status").matches(condition::equals("ACTIVE")))).pipe([transformer::array::length()]).matches(condition::number::greater_than(0)),
                "message": "To agree the plan, create a goal to work on now",
            }),
            // Each active goal must have at least one action — produces a
            // separate error message per goal that is missing actions
            data("goals").each(iterator::filter(item().path("status").matches(condition::equals("ACTIVE")))).each(iterator::map(validation(obj! {
                "condition": item().path("actions").pipe([transformer::array::length()]).matches(condition::number::greater_than(0)),
                "message": format("Add actions to '%1'", [item().path("title").into()]),
            })))
            .into(),
        ],
    })
}

pub fn continue_button() -> Value {
    govuk::BUTTON.build(obj! { "text": "Continue" })
}

pub fn manage_goals_link() -> Value {
    govuk::LINK_BUTTON.build(obj! {
        "text": "Add actions to goals",
        "href": "/forge-developer-guide/patterns/demos/collection-validation/manage-plan",
        "classes": "govuk-button--secondary",
    })
}

pub fn button_group() -> Value {
    govuk::BUTTON_GROUP.build(obj! {
        "buttons": [continue_button(), manage_goals_link()],
    })
}
