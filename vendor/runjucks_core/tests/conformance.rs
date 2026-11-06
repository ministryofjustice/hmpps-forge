//! JSON-driven render conformance vs Nunjucks golden outputs.
//! Fixtures: [`native/fixtures/conformance/`](../../../fixtures/conformance/README.md)

use runjucks_core::Environment;
use serde::Deserialize;
use serde_json::Value;

#[derive(Debug, Deserialize)]
struct Case {
    id: String,
    #[allow(dead_code)]
    source: Option<String>,
    template: String,
    #[serde(default)]
    context: Value,
    env: Option<EnvOpt>,
    expected: String,
    /// When true, skip until engine matches Nunjucks (see `ai_docs/NUNJUCKS_PARITY.md`).
    #[serde(default)]
    skip: bool,
}

#[derive(Debug, Deserialize)]
struct EnvOpt {
    #[serde(default)]
    autoescape: Option<bool>,
    #[serde(default)]
    dev: Option<bool>,
    #[serde(default)]
    throw_on_undefined: Option<bool>,
    #[serde(default, rename = "randomSeed")]
    random_seed: Option<u64>,
    /// Merged into [`Environment::globals`] via [`Environment::add_global`] (defaults from
    /// [`Environment::default`] remain unless a key is overridden).
    #[serde(default)]
    globals: Option<Value>,
}

fn all_cases() -> Vec<Case> {
    let mut out: Vec<Case> = serde_json::from_str(include_str!(
        "../../../fixtures/conformance/render_cases.json"
    ))
    .expect("parse render_cases.json");
    let filter: Vec<Case> = serde_json::from_str(include_str!(
        "../../../fixtures/conformance/filter_cases.json"
    ))
    .expect("parse filter_cases.json");
    out.extend(filter);
    out
}

#[test]
fn conformance_render_matches_nunjucks_golden_outputs() {
    for case in all_cases() {
        let mut env = Environment::default();
        if let Some(ref e) = case.env {
            if let Some(a) = e.autoescape {
                env.autoescape = a;
            }
            if let Some(d) = e.dev {
                env.dev = d;
            }
            if let Some(t) = e.throw_on_undefined {
                env.throw_on_undefined = t;
            }
            if let Some(s) = e.random_seed {
                env.random_seed = Some(s);
            }
            if let Some(Value::Object(map)) = e.globals.clone() {
                for (k, v) in map {
                    env.add_global(k, v);
                }
            }
        }
        if case.skip {
            continue;
        }
        let result = env.render_string(case.template.clone(), case.context.clone());
        match result {
            Ok(out) => assert_eq!(out, case.expected, "case {}", case.id),
            Err(e) => panic!(
                "case {}: render error: {} (source: {:?})",
                case.id, e, case.source
            ),
        }
    }
}
