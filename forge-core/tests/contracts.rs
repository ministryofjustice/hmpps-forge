//! Runs the contract fixtures (`fixtures/contracts.json`: journeys and requests, first recorded
//! from the TS contract tests) against the engine.
//!
//! Every row is checked twice: against its authored verdicts (the contract assertions), and
//! against the full recorded outcome (render context, redirect URL or error, response headers,
//! session after). `UPDATE_FIXTURES=1` rewrites the recorded outcomes from this implementation;
//! the verdicts are authored and never rewritten.

mod support;

use std::fmt::Write as _;
use std::sync::Arc;

use forge_core::engine::mount::ForgeRoute;
use forge_core::engine::runtime::context::RequestLocation;
use forge_core::framework::{HttpMethod, OutcomeKind, RecordingResponse, RequestSnapshot};
use forge_core::route_path::resolve_path_params;
use forge_core::{Forge, ForgeOptions, ForgePackage, Value};

fn corpus() -> Option<Value> {
    serde_json::from_str(&forge_core::testing::fixtures::read("contracts.json")?).ok()
}

/// `TestRouteResolver.normalizePath`.
fn normalize_path(path: &str) -> String {
    let with_slash = if path.starts_with('/') { path.to_string() } else { format!("/{path}") };
    if with_slash.len() > 1 && with_slash.ends_with('/') { with_slash[..with_slash.len() - 1].to_string() } else { with_slash }
}

fn extract_pathname(path: &str) -> &str {
    path.split(['?', '#']).next().unwrap_or(path)
}

/// `TestRouteResolver.resolve`.
fn resolve_route<'a>(routes: &'a [ForgeRoute], path: &str) -> Option<(&'a ForgeRoute, Value)> {
    let pathname = normalize_path(extract_pathname(path));
    let segs = |p: &str| normalize_path(p).split('/').filter(|s| !s.is_empty()).map(str::to_string).collect::<Vec<_>>();
    let actual = segs(&pathname);
    for route in routes {
        let pattern = segs(&route.template_path);
        if pattern.len() != actual.len() {
            continue;
        }
        let mut params = forge_core::value::Map::new();
        let matched = pattern.iter().zip(actual.iter()).all(|(p, a)| match p.strip_prefix(':') {
            Some(name) => {
                params.insert(name.into(), Value::from(a.as_str()));
                true
            }
            None => p == a,
        });
        if matched {
            return Some((route, Value::object(params)));
        }
    }
    None
}

/// Normalises a value the way a JSON round trip would (drops `undefined`, unwraps opaques).
fn json(v: &Value) -> Value {
    Value::from_json(&v.to_json())
}

/// `expect.objectContaining` with nested `toEqual` semantics.
fn contains(actual: &Value, expected: &Value) -> bool {
    match expected {
        Value::Object(e) => e.iter().all(|(k, ev)| ev.deep_eq(&actual.get(k))),
        other => other.deep_eq(actual),
    }
}

fn first_diff(path: &str, a: &Value, b: &Value, out: &mut Vec<String>) {
    if out.len() >= 4 {
        return;
    }
    match (a, b) {
        (Value::Object(x), Value::Object(y)) => {
            let keys: Vec<_> = x.keys().chain(y.keys().filter(|k| !x.contains_key(*k))).cloned().collect();
            for k in keys {
                first_diff(&format!("{path}.{k}"), &a.get(&k), &b.get(&k), out);
            }
        }
        (Value::Array(x), Value::Array(y)) if x.len() == y.len() => {
            for (i, (p, q)) in x.iter().zip(y.iter()).enumerate() {
                first_diff(&format!("{path}[{i}]"), p, q, out);
            }
        }
        _ if a.deep_eq(b) => {}
        _ => out.push(format!("{path}: rust={a:?} ts={b:?}")),
    }
}

struct RowResult {
    verdict_failures: Vec<String>,
    full_diffs: Vec<String>,
    /// This implementation's outcome and session after, as stored in the fixture.
    outcome: Option<(Value, Value)>,
}

async fn run_row(case: &Value, row: &Value) -> RowResult {
    let mut verdict_failures = Vec::new();
    let mut full_diffs = Vec::new();

    let mut forge = Forge::new(ForgeOptions::default());
    let package = ForgePackage::new(case.get("journey"))
        .with_functions(support::fixtures::functions())
        .with_components(support::fixtures::components());
    if let Err(e) = forge.register_package(package) {
        verdict_failures.push(format!("registration failed: {e}"));
        return RowResult { verdict_failures, full_diffs, outcome: None };
    }
    let routes = forge.topology();
    let path = row.get("path").to_js_string();
    let Some((route, params)) = resolve_route(&routes, &path) else {
        verdict_failures.push(format!("no route matched {path}"));
        return RowResult { verdict_failures, full_diffs, outcome: None };
    };
    let method = if row.get("method").as_str() == Some("POST") { HttpMethod::Post } else { HttpMethod::Get };
    let origin = "http://localhost".to_string();
    let snapshot = RequestSnapshot {
        node_id: route.node_id.as_str().into(),
        method,
        location: RequestLocation {
            href: format!("{origin}{path}"),
            pathname: extract_pathname(&path).to_string(),
            base_path: resolve_path_params(&route.base_path, &params),
            origin,
        },
        params,
        query: Value::empty_object(),
        post: match row.get("body") {
            Value::Undefined => Value::empty_object(),
            b => b,
        },
        headers: Value::empty_object(),
        cookies: Value::empty_object(),
        state: Value::empty_object(),
        session: row.get("session"),
    };
    let response = Arc::new(RecordingResponse::default());
    let result = forge.execute(&snapshot, response.clone()).await;
    let headers: Value = Value::object(
        response.headers.lock().unwrap().iter().map(|(k, v)| (k.as_str().into(), Value::from(v.as_str()))).collect(),
    );

    // The Rust outcome in the exporter's JSON shape.
    let (actual, session_after) = match result {
        Ok(outcome) => {
            let a = match &outcome.kind {
                OutcomeKind::Navigate { url } => Value::from_pairs([("type", Value::from("redirect")), ("url", Value::from(url.as_str())), ("headers", headers.clone())]),
                OutcomeKind::Error(e) => Value::from_pairs([
                    ("type", Value::from("error")),
                    ("status", Value::from(i64::from(e.status))),
                    ("message", Value::from(e.message.as_str())),
                    ("headers", headers.clone()),
                ]),
                OutcomeKind::Render { context, .. } => {
                    Value::from_pairs([("type", Value::from("render")), ("context", json(context)), ("headers", headers.clone())])
                }
            };
            (a, outcome.session)
        }
        Err(e) => (
            Value::from_pairs([
                ("type", Value::from("error")),
                ("status", e.status().map_or(Value::Undefined, |s| Value::from(i64::from(s)))),
                ("message", Value::from(e.to_string())),
                ("headers", headers.clone()),
            ]),
            row.get("session"),
        ),
    };

    // Verdicts (ContractAssertions).
    let v = row.get("verdicts");
    let ty = actual.get("type").to_js_string();
    let describe = || match ty.as_str() {
        "redirect" => format!("redirected to {}", actual.get("url")),
        "error" => format!("errored with {}: {}", actual.get("status"), actual.get("message")),
        _ => format!(
            "rendered with field errors {:?} and domain errors {:?}",
            actual.get("context").get("fieldValidationErrors"),
            actual.get("context").get("domainValidationErrors")
        ),
    };
    if !v.get("valid").is_undefined() || !v.get("redirectTo").is_undefined() {
        if ty != "redirect" {
            verdict_failures.push(format!("expected redirect, {}", describe()));
        } else {
            let expected = match v.get("redirectTo") {
                Value::Undefined => row.get("validRedirect"),
                r => r,
            };
            if !expected.is_undefined() && !expected.deep_eq(&actual.get("url")) {
                verdict_failures.push(format!("redirect url {} != {}", actual.get("url"), expected));
            }
        }
    }
    if let Value::Object(e) = v.get("error") {
        if ty != "error" {
            verdict_failures.push(format!("expected error, {}", describe()));
        } else {
            for key in ["status", "message"] {
                if !e.get(key).cloned().unwrap_or_default().deep_eq(&actual.get(key)) {
                    verdict_failures.push(format!("error {key} {:?} != {:?}", actual.get(key), e.get(key)));
                }
            }
        }
    }
    let render_keys = ["rendered", "errors", "domainErrors", "showFailures", "current", "parsed", "data"];
    if render_keys.iter().any(|k| !v.get(k).is_undefined()) {
        if ty != "render" {
            verdict_failures.push(format!("expected render, {}", describe()));
        } else {
            let ctx = actual.get("context");
            if let Value::Bool(b) = v.get("showFailures")
                && ctx.get("showValidationFailures").as_bool() != Some(b)
            {
                verdict_failures.push(format!("showValidationFailures != {b}"));
            }
            if let Value::Object(errors) = v.get("errors") {
                let field_errors = ctx.get("fieldValidationErrors");
                if errors.is_empty() {
                    if field_errors.as_array().is_some_and(|a| !a.is_empty()) {
                        verdict_failures.push(format!("expected no field errors, got {field_errors:?}"));
                    }
                }
                for (code, expected) in errors.iter() {
                    let actual_errors: Vec<Value> = field_errors
                        .as_array()
                        .map(|a| a.iter().filter(|e| e.get("blockCode").as_str() == Some(code)).cloned().collect())
                        .unwrap_or_default();
                    let expected = expected.as_array().cloned().unwrap_or_default();
                    let ok = actual_errors.len() == expected.len()
                        && actual_errors.iter().zip(expected.iter()).all(|(a, e)| match e {
                            Value::String(m) => a.get("message").as_str() == Some(m),
                            obj => contains(a, obj),
                        });
                    if !ok {
                        verdict_failures.push(format!("field errors for {code}: {actual_errors:?} != {expected:?}"));
                    }
                }
            }
            if let Value::Array(expected) = v.get("domainErrors") {
                let actual_errors = ctx.get("domainValidationErrors");
                let a = actual_errors.as_array().cloned().unwrap_or_default();
                let ok = a.len() == expected.len()
                    && a.iter().zip(expected.iter()).all(|(a, e)| match e {
                        Value::String(m) => a.get("message").as_str() == Some(m),
                        obj => contains(a, obj),
                    });
                if !ok {
                    verdict_failures.push(format!("domain errors {actual_errors:?} != {expected:?}"));
                }
            }
            for (key, field) in [("current", "current"), ("parsed", "parsed")] {
                if let Value::Object(expected) = v.get(key) {
                    for (code, value) in expected.iter() {
                        let got = ctx.get("answers").get(code).get(field);
                        if !value.deep_eq(&got) {
                            verdict_failures.push(format!("{key}.{code}: {got:?} != {value:?}"));
                        }
                    }
                }
            }
            if let Value::Object(expected) = v.get("data") {
                for (key, value) in expected.iter() {
                    let got = ctx.get("data").get(key);
                    if !value.deep_eq(&got) {
                        verdict_failures.push(format!("data.{key}: {got:?} != {value:?}"));
                    }
                }
            }
        }
    }
    if let Value::Object(expected) = v.get("headers") {
        for (name, value) in expected.iter() {
            if !value.deep_eq(&headers.get(name)) {
                verdict_failures.push(format!("header {name}: {:?} != {value:?}", headers.get(name)));
            }
        }
    }
    if let saved @ Value::Object(_) = v.get("saved") {
        let got = json(&session_after.get("answers").get(&row.get("savedJourneyCode").to_js_string()));
        let got = if got.is_nullish() { Value::empty_object() } else { got };
        if !saved.deep_eq(&got) {
            verdict_failures.push(format!("saved {got:?} != {saved:?}"));
        }
    }

    // Full outcome parity.
    let ts = row.get("actual");
    first_diff("", &json(&actual), &ts, &mut full_diffs);
    let ts_session = row.get("sessionAfter");
    first_diff("session", &json(&session_after), &ts_session, &mut full_diffs);

    RowResult { verdict_failures, full_diffs, outcome: Some((json(&actual), json(&session_after))) }
}

#[tokio::test]
async fn contract_corpus() {
    let Some(corpus) = corpus() else {
        eprintln!("contract corpus not exported; skipping");
        return;
    };
    let mut rows = 0;
    let mut verdict_pass = 0;
    let mut full_pass = 0;
    let mut report = String::new();
    let mut by_file: std::collections::BTreeMap<String, [usize; 3]> = Default::default();
    let updating = forge_core::testing::fixtures::updating();
    let mut updated_cases = Vec::new();
    for case in corpus.as_array().unwrap().iter() {
        let file = case.get("file").to_js_string();
        let mut updated_rows = Vec::new();
        for row in case.get("rows").as_array().unwrap().iter() {
            let result = run_row(case, row).await;
            if updating {
                let mut row = row.clone();
                let (outcome, session) = result.outcome.expect("row ran");
                row.set("actual", outcome);
                row.set("sessionAfter", session);
                updated_rows.push(row);
                continue;
            }
            rows += 1;
            let stats = by_file.entry(file.clone()).or_default();
            stats[2] += 1;
            if result.verdict_failures.is_empty() {
                verdict_pass += 1;
                stats[0] += 1;
            }
            if result.full_diffs.is_empty() {
                full_pass += 1;
                stats[1] += 1;
            }
            if !result.verdict_failures.is_empty() || !result.full_diffs.is_empty() {
                let _ = writeln!(report, "## {} :: {} :: {}", file, case.get("description"), row.get("name"));
                for f in &result.verdict_failures {
                    let _ = writeln!(report, "  VERDICT {f}");
                }
                for d in &result.full_diffs {
                    let _ = writeln!(report, "  DIFF    {d}");
                }
            }
        }
        let mut case = case.clone();
        case.set("rows", Value::array(updated_rows));
        updated_cases.push(case);
    }
    if updating {
        forge_core::testing::fixtures::write_json("contracts.json", &Value::array(updated_cases).to_json());
        return;
    }
    let mut summary = String::from("| file | verdicts | full outcome | rows |\n|---|---|---|---|\n");
    for (file, [v, f, n]) in &by_file {
        let _ = writeln!(summary, "| {file} | {v} | {f} | {n} |");
    }
    let _ = writeln!(summary, "| **total** | {verdict_pass} | {full_pass} | {rows} |");
    let out = forge_core::testing::fixtures::report_dir().display().to_string();
    std::fs::write(format!("{out}/summary.md"), &summary).unwrap();
    std::fs::write(format!("{out}/failures.md"), &report).unwrap();
    eprintln!("{summary}");
    assert_eq!(verdict_pass, rows, "contract verdicts failed; see target/fixture-reports/failures.md");
    assert_eq!(full_pass, rows, "recorded outcomes differ; see target/fixture-reports/failures.md");
}
