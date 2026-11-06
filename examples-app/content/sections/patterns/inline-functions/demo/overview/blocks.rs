use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

pub fn heading() -> Value {
    govuk::HEADING.build(obj! {
        "text": "Shaping data inline",
        "size": "l",
        "caption": "Pattern",
    })
}

pub fn intro() -> Value {
    govuk::BODY.build(obj! {
        "text": "This demo renders the same case overview dashboard twice. Both\n  pages load the same data and produce identical output. The difference\n  is in the source code: the first version shapes data using chained\n  expressions, the second extracts that logic into inline transformers.",
    })
}

pub fn shows() -> Value {
    govuk::HEADING.build(obj! { "text": "What this pattern shows", "size": "s" })
}

pub fn shows_list() -> Value {
    govuk::LIST.build(obj! {
        "items": literal([
            "A verbose version with repeated when().then().else() chains for 6 risk scores",
            "A clean version using a riskRow() helper backed by one inline transformer",
            "Goals and compliance summaries computed by inline transformers instead of the effect",
            "How the rendered output stays identical while the source becomes dramatically shorter",
        ]),
        "style": "bullet",
    })
}

pub fn start_button() -> Value {
    govuk::LINK_BUTTON.build(obj! {
        "text": "Start with the verbose version",
        "href": "/forge-developer-guide/patterns/demos/inline-functions/before",
        "isStartButton": true,
    })
}
