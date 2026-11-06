//! JSON goldens from [`native/fixtures/conformance/tag_parity_cases.json`](../../../fixtures/conformance/tag_parity_cases.json).

use runjucks_core::loader::map_loader;
use runjucks_core::{Environment, Tags};
use serde::Deserialize;
use serde_json::Value;
use std::collections::HashMap;

#[derive(Debug, Deserialize)]
struct JsonTags {
    #[serde(default, rename = "blockStart")]
    block_start: Option<String>,
    #[serde(default, rename = "blockEnd")]
    block_end: Option<String>,
    #[serde(default, rename = "variableStart")]
    variable_start: Option<String>,
    #[serde(default, rename = "variableEnd")]
    variable_end: Option<String>,
    #[serde(default, rename = "commentStart")]
    comment_start: Option<String>,
    #[serde(default, rename = "commentEnd")]
    comment_end: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CaseEnv {
    #[serde(default, rename = "templateMap")]
    template_map: Option<HashMap<String, String>>,
    #[serde(default, rename = "trimBlocks")]
    trim_blocks: Option<bool>,
    #[serde(default, rename = "lstripBlocks")]
    lstrip_blocks: Option<bool>,
    #[serde(default)]
    tags: Option<JsonTags>,
}

#[derive(Debug, Deserialize)]
struct Case {
    id: String,
    #[allow(dead_code)]
    source: Option<String>,
    template: String,
    #[serde(default)]
    context: Value,
    #[serde(default)]
    env: Option<CaseEnv>,
    expected: String,
    #[serde(default)]
    skip: bool,
}

#[test]
fn tag_parity_cases_match_expected() {
    let cases: Vec<Case> = serde_json::from_str(include_str!(
        "../../../fixtures/conformance/tag_parity_cases.json"
    ))
    .expect("parse tag_parity_cases.json");
    for case in cases {
        if case.skip {
            continue;
        }
        let mut env = Environment::default();
        if let Some(e) = &case.env {
            if let Some(map) = &e.template_map {
                env.loader = Some(map_loader(map.clone()));
            }
            if let Some(true) = e.trim_blocks {
                env.trim_blocks = true;
            }
            if let Some(true) = e.lstrip_blocks {
                env.lstrip_blocks = true;
            }
            if let Some(ref t) = e.tags {
                let defaults = Tags::default();
                env.tags = Some(Tags {
                    block_start: t.block_start.clone().unwrap_or(defaults.block_start),
                    block_end: t.block_end.clone().unwrap_or(defaults.block_end),
                    variable_start: t.variable_start.clone().unwrap_or(defaults.variable_start),
                    variable_end: t.variable_end.clone().unwrap_or(defaults.variable_end),
                    comment_start: t.comment_start.clone().unwrap_or(defaults.comment_start),
                    comment_end: t.comment_end.clone().unwrap_or(defaults.comment_end),
                });
            }
        }
        let out = env
            .render_string(case.template.clone(), case.context.clone())
            .unwrap_or_else(|e| panic!("case {}: {e}", case.id));
        assert_eq!(out, case.expected, "case {}", case.id);
    }
}
