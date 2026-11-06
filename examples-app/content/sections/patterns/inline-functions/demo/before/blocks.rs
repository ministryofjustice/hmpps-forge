use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

pub fn heading() -> Value {
    govuk::HEADING.build(obj! {
        "text": format("%1 %2", [data("case.name.firstName").into(), data("case.name.lastName").into()]),
        "size": "l",
        "caption": format("CRN: %1", [data("case.crn").into()]),
    })
}

pub fn risk_heading() -> Value {
    govuk::HEADING.build(obj! { "text": "Risk scores", "size": "m" })
}

pub fn risk_scores() -> Value {
    govuk::SUMMARY_LIST.build(obj! {
        "rows": [
            obj! {
                "key": obj! { "text": "Overall" },
                "value": obj! {
                    "html": when(data("case.riskScores.overall").matches(condition::equals("VERY_HIGH"))).then("<strong class=\"govuk-tag govuk-tag--red\">Very high</strong>").otherwise(when(data("case.riskScores.overall").matches(condition::equals("HIGH"))).then("<strong class=\"govuk-tag govuk-tag--red\">High</strong>").otherwise(when(data("case.riskScores.overall").matches(condition::equals("MEDIUM"))).then("<strong class=\"govuk-tag govuk-tag--yellow\">Medium</strong>").otherwise("<strong class=\"govuk-tag govuk-tag--green\">Low</strong>"))),
                },
            },
            obj! {
                "key": obj! { "text": "Self-harm" },
                "value": obj! {
                    "html": when(data("case.riskScores.selfHarm").matches(condition::equals("VERY_HIGH"))).then("<strong class=\"govuk-tag govuk-tag--red\">Very high</strong>").otherwise(when(data("case.riskScores.selfHarm").matches(condition::equals("HIGH"))).then("<strong class=\"govuk-tag govuk-tag--red\">High</strong>").otherwise(when(data("case.riskScores.selfHarm").matches(condition::equals("MEDIUM"))).then("<strong class=\"govuk-tag govuk-tag--yellow\">Medium</strong>").otherwise("<strong class=\"govuk-tag govuk-tag--green\">Low</strong>"))),
                },
            },
            obj! {
                "key": obj! { "text": "Public protection" },
                "value": obj! {
                    "html": when(data("case.riskScores.publicProtection").matches(condition::equals("VERY_HIGH"))).then("<strong class=\"govuk-tag govuk-tag--red\">Very high</strong>").otherwise(when(data("case.riskScores.publicProtection").matches(condition::equals("HIGH"))).then("<strong class=\"govuk-tag govuk-tag--red\">High</strong>").otherwise(when(data("case.riskScores.publicProtection").matches(condition::equals("MEDIUM"))).then("<strong class=\"govuk-tag govuk-tag--yellow\">Medium</strong>").otherwise("<strong class=\"govuk-tag govuk-tag--green\">Low</strong>"))),
                },
            },
            obj! {
                "key": obj! { "text": "Known adult" },
                "value": obj! {
                    "html": when(data("case.riskScores.knownAdult").matches(condition::equals("VERY_HIGH"))).then("<strong class=\"govuk-tag govuk-tag--red\">Very high</strong>").otherwise(when(data("case.riskScores.knownAdult").matches(condition::equals("HIGH"))).then("<strong class=\"govuk-tag govuk-tag--red\">High</strong>").otherwise(when(data("case.riskScores.knownAdult").matches(condition::equals("MEDIUM"))).then("<strong class=\"govuk-tag govuk-tag--yellow\">Medium</strong>").otherwise("<strong class=\"govuk-tag govuk-tag--green\">Low</strong>"))),
                },
            },
            obj! {
                "key": obj! { "text": "Children" },
                "value": obj! {
                    "html": when(data("case.riskScores.children").matches(condition::equals("VERY_HIGH"))).then("<strong class=\"govuk-tag govuk-tag--red\">Very high</strong>").otherwise(when(data("case.riskScores.children").matches(condition::equals("HIGH"))).then("<strong class=\"govuk-tag govuk-tag--red\">High</strong>").otherwise(when(data("case.riskScores.children").matches(condition::equals("MEDIUM"))).then("<strong class=\"govuk-tag govuk-tag--yellow\">Medium</strong>").otherwise("<strong class=\"govuk-tag govuk-tag--green\">Low</strong>"))),
                },
            },
            obj! {
                "key": obj! { "text": "Staff" },
                "value": obj! {
                    "html": when(data("case.riskScores.staff").matches(condition::equals("VERY_HIGH"))).then("<strong class=\"govuk-tag govuk-tag--red\">Very high</strong>").otherwise(when(data("case.riskScores.staff").matches(condition::equals("HIGH"))).then("<strong class=\"govuk-tag govuk-tag--red\">High</strong>").otherwise(when(data("case.riskScores.staff").matches(condition::equals("MEDIUM"))).then("<strong class=\"govuk-tag govuk-tag--yellow\">Medium</strong>").otherwise("<strong class=\"govuk-tag govuk-tag--green\">Low</strong>"))),
                },
            },
        ],
    })
}

pub fn sentence_heading() -> Value {
    govuk::HEADING.build(obj! { "text": "Sentence", "size": "m" })
}

pub fn sentence_details() -> Value {
    govuk::SUMMARY_LIST.build(obj! {
        "rows": [
            obj! {
                "key": obj! { "text": "Type" },
                "value": obj! { "text": data("case.sentence.type") },
            },
            obj! {
                "key": obj! { "text": "Start date" },
                "value": obj! { "text": data("case.sentence.startDate") },
            },
            obj! {
                "key": obj! { "text": "End date" },
                "value": obj! { "text": data("case.sentence.endDate") },
            },
        ],
    })
}

pub fn goals_heading() -> Value {
    govuk::HEADING.build(obj! { "text": "Goals", "size": "m" })
}

pub fn goals_summary() -> Value {
    govuk::BODY.build(obj! {
        "text": format("%1 of %2 goals achieved", [data("goalsAchieved").into(), data("goalsTotal").into()]),
        "classes": "govuk-!-font-weight-bold",
    })
}

pub fn compliance_heading() -> Value {
    govuk::HEADING.build(obj! { "text": "Compliance", "size": "m" })
}

pub fn compliance_summary() -> Value {
    govuk::BODY.build(obj! {
        "text": format("%1% attendance rate", [data("complianceRate").into()]),
        "classes": "govuk-!-font-weight-bold",
    })
}

pub fn next_button() -> Value {
    govuk::LINK_BUTTON.build(obj! {
        "text": "See the refactored version",
        "href": "/forge-developer-guide/patterns/demos/inline-functions/after",
    })
}
