//! Request traces (`RequestTraceEvent`, what instrumentation sinks such as the devtools bridge
//! receive) for every contract row, against the recorded traces (`fixtures/traces.ndjson`, first
//! recorded from the TS engine). `UPDATE_FIXTURES=1` rewrites the recorded traces (the devtools
//! messages in the same file are rewritten by forge-devtools' `messages` test).
//!
//! Timings are compared by presence only: every timing value is stored as `true`.

mod support;

use std::fmt::Write as _;
use std::sync::{Arc, Mutex};

use forge_core::engine::mount::ForgeRoute;
use forge_core::engine::runtime::context::RequestLocation;
use forge_core::engine::tracing::{Instrumentation, InstrumentationSink, RequestTraceEvent};
use forge_core::framework::{HttpMethod, RecordingResponse, RequestSnapshot};
use forge_core::route_path::resolve_path_params;
use forge_core::{Forge, ForgeOptions, ForgePackage, Value};
use serde_json::Value as Json;

const TIMING_KEYS: &[&str] = &["startedAtMs", "completedAtMs", "durationMs", "selfDurationMs", "executionSlices"];

fn read(name: &str) -> Option<String> {
    forge_core::testing::fixtures::read(name)
}

fn normalize_path(path: &str) -> String {
    let with_slash = if path.starts_with('/') { path.to_string() } else { format!("/{path}") };
    if with_slash.len() > 1 && with_slash.ends_with('/') { with_slash[..with_slash.len() - 1].to_string() } else { with_slash }
}

fn extract_pathname(path: &str) -> &str {
    path.split(['?', '#']).next().unwrap_or(path)
}

fn resolve_route<'a>(routes: &'a [ForgeRoute], path: &str) -> Option<(&'a ForgeRoute, Value)> {
    let pathname = normalize_path(extract_pathname(path));
    let segs = |p: &str| normalize_path(p).split('/').filter(|s| !s.is_empty()).map(str::to_string).collect::<Vec<_>>();
    let actual = segs(&pathname);
    routes.iter().find_map(|route| {
        let pattern = segs(&route.template_path);
        if pattern.len() != actual.len() {
            return None;
        }
        let mut params = forge_core::value::Map::new();
        let matched = pattern.iter().zip(actual.iter()).all(|(p, a)| match p.strip_prefix(':') {
            Some(name) => {
                params.insert(name.into(), Value::from(a.as_str()));
                true
            }
            None => p == a,
        });
        matched.then(|| (route, Value::object(params)))
    })
}

#[derive(Default)]
struct Recorder(Mutex<Vec<RequestTraceEvent>>);

impl InstrumentationSink for Recorder {
    fn on_request_trace(&self, event: &RequestTraceEvent) {
        self.0.lock().unwrap().push(event.clone());
    }
}

/// Timings become `true` (as the exporter writes them) and error stacks are dropped.
fn mask(json: &mut Json) {
    match json {
        Json::Object(map) => {
            for (k, v) in map.iter_mut() {
                if TIMING_KEYS.contains(&k.as_str()) {
                    *v = Json::Bool(true);
                } else {
                    mask(v);
                }
            }
            map.remove("stack");
        }
        Json::Array(items) => items.iter_mut().for_each(mask),
        _ => {}
    }
}

fn diff(path: &str, a: &Json, b: &Json, out: &mut Vec<String>) {
    if out.len() >= 6 {
        return;
    }
    match (a, b) {
        (Json::Object(x), Json::Object(y)) => {
            for k in x.keys().chain(y.keys().filter(|k| !x.contains_key(*k))) {
                diff(&format!("{path}.{k}"), x.get(k).unwrap_or(&Json::Null), y.get(k).unwrap_or(&Json::Null), out);
            }
            for k in x.keys().filter(|k| !y.contains_key(*k)) {
                out.push(format!("{path}.{k}: only in rust"));
            }
            for k in y.keys().filter(|k| !x.contains_key(*k)) {
                out.push(format!("{path}.{k}: only in ts"));
            }
        }
        (Json::Array(x), Json::Array(y)) => {
            if x.len() != y.len() {
                let keys = |v: &[Json]| v.iter().map(|u| u.get("key").or(u.get("phase")).cloned().unwrap_or(Json::Null)).collect::<Vec<_>>();
                out.push(format!("{path}: len rust={} ts={} keys rust={:?} ts={:?}", x.len(), y.len(), keys(x), keys(y)));
                return;
            }
            for (i, (p, q)) in x.iter().zip(y.iter()).enumerate() {
                diff(&format!("{path}[{i}]"), p, q, out);
            }
        }
        _ if a == b => {}
        _ => out.push(format!("{path}: rust={a} ts={b}")),
    }
}

async fn traces_for(case: &Value, row: &Value) -> Result<Vec<Json>, String> {
    let recorder = Arc::new(Recorder::default());
    let options = ForgeOptions { instrumentation: Instrumentation::new(vec![recorder.clone()]), ..ForgeOptions::default() };
    let mut forge = Forge::new(options);
    let package = ForgePackage::new(case.get("journey"))
        .with_functions(support::fixtures::functions())
        .with_components(support::fixtures::components());
    forge.register_package(package).map_err(|e| format!("registration failed: {e}"))?;
    let routes = forge.topology();
    let path = row.get("path").to_js_string();
    let (route, params) = resolve_route(&routes, &path).ok_or_else(|| format!("no route matched {path}"))?;
    let origin = "http://localhost".to_string();
    let snapshot = RequestSnapshot {
        node_id: route.node_id.as_str().into(),
        method: if row.get("method").as_str() == Some("POST") { HttpMethod::Post } else { HttpMethod::Get },
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
    let _ = forge.execute(&snapshot, Arc::new(RecordingResponse::default())).await;
    let events = recorder.0.lock().unwrap();
    Ok(events
        .iter()
        .map(|e| {
            let mut json = e.to_json();
            mask(&mut json);
            json
        })
        .collect())
}

#[tokio::test]
async fn request_traces_match_ts() {
    let (Some(contracts), Some(traces)) = (read("contracts.json"), read("traces.ndjson")) else {
        eprintln!("trace corpus not exported; skipping");
        return;
    };
    let contracts: Value = serde_json::from_str(&contracts).unwrap();
    let cases = contracts.as_array().unwrap();
    let mut pass = 0;
    let mut total = 0;
    let mut report = String::new();
    let updating = forge_core::testing::fixtures::updating();
    let mut updated = Vec::new();
    for line in traces.lines().filter(|l| !l.trim().is_empty()) {
        let mut entry: Json = serde_json::from_str(line).unwrap();
        let case = &cases[entry["caseIndex"].as_u64().unwrap() as usize];
        let row = case.get("rows").as_array().unwrap()[entry["rowIndex"].as_u64().unwrap() as usize].clone();
        let row = &row;
        assert_eq!(row.get("name").as_str(), entry["name"].as_str(), "rows pair up with contracts.json");
        let mut expected = entry["traces"].clone();
        mask(&mut expected);
        total += 1;
        let mut diffs = Vec::new();
        if updating {
            entry["traces"] = Json::Array(traces_for(case, row).await.expect("traces"));
            updated.push(entry);
            continue;
        }
        match traces_for(case, row).await {
            Ok(actual) => diff("", &Json::Array(actual), &expected, &mut diffs),
            Err(e) => diffs.push(e),
        }
        if diffs.is_empty() {
            pass += 1;
        } else {
            let _ = writeln!(report, "## {} :: {} :: {}", entry["file"], case.get("description"), row.get("name"));
            for d in diffs {
                let _ = writeln!(report, "  {d}");
            }
        }
    }
    if updating {
        forge_core::testing::fixtures::write_ndjson("traces.ndjson", &updated);
        return;
    }
    let summary = format!("request traces: {pass}/{total} identical\n");
    let dir = forge_core::testing::fixtures::report_dir().display().to_string();
    std::fs::create_dir_all(&dir).unwrap();
    std::fs::write(format!("{dir}/traces.txt"), format!("{summary}\n{report}")).unwrap();
    eprint!("{summary}");
    assert_eq!(pass, total, "trace mismatches; see target/fixture-reports/traces.txt");
}
