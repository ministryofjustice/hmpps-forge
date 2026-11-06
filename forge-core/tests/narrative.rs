//! Replays the narrative contract fixtures (`fixtures/narrative.ndjson`, first recorded from the TS
//! narrative contract tests): every package registration must succeed or fail with the recorded
//! error and compilation trace, and every test-client request must produce the recorded outcome
//! (type, redirect, error, render context, headers, cookies) and leave the recorded session.
//! `UPDATE_FIXTURES=1` rewrites those recorded results from this implementation.
//!
//! Recorded values that JSON cannot carry (functions, bigints, symbols inside journeys) mark a
//! registration unrepresentable; those are counted, not compared.

mod support;

use std::collections::HashMap;

use std::sync::{Arc, Mutex};

use forge_core::engine::errors::ForgeError;
use forge_core::engine::registries::FunctionEntry;
use forge_core::schema::Schema;
use forge_core::testing::{ForgeTestClient, ForgeTestHarness, TestRequestOptions};
use forge_core::value::Map;
use forge_core::engine::tracing::{CompilationTraceEvent, Instrumentation, InstrumentationSink, RequestTraceEvent};
use forge_core::framework::RequestSnapshot;
use forge_core::{Forge, ForgeOptions, ForgePackage, Value};

fn corpus() -> Option<String> {
    std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/../fixtures/narrative.ndjson")).ok()
}

/// Decodes the recorder's tags; `None` when a value has no Rust representation.
fn decode(v: &Value) -> Option<Value> {
    decode_with(v, false)
}

/// For outcomes: function-valued properties (compiled conditions TS exposes in the render
/// context) are dropped, as the JSON round trip the declarative oracle compares drops them.
fn decode_outcome(v: &Value) -> Option<Value> {
    decode_with(v, true)
}

fn decode_with(v: &Value, drop_functions: bool) -> Option<Value> {
    let decode = |x: &Value| decode_with(x, drop_functions);
    Some(match v {
        Value::Object(o) if drop_functions && o.contains_key("$function") => Value::Undefined,
        Value::Object(o) if o.contains_key("$undefined") => Value::Undefined,
        // A JS Date: Rust journeys can carry one as a JsDate value.
        Value::Object(o) if o.contains_key("$date") => match o["$date"].as_str() {
            Some(iso) => Value::opaque(forge_core::jsdate::JsDate::parse(iso)),
            None => Value::opaque(forge_core::jsdate::JsDate::invalid()),
        },
        Value::Object(o)
            if ["$map", "$function", "$bigint", "$symbol", "$regexp", "$circular", "$error"].iter().any(|k| o.contains_key(*k)) =>
        {
            return None;
        }
        Value::Object(o) => {
            let mut m = Map::new();
            for (k, x) in o.iter() {
                m.insert(k.clone(), decode(x)?);
            }
            Value::object(m)
        }
        Value::Array(a) => Value::array(a.iter().map(decode).collect::<Option<Vec<_>>>()?),
        other => other.clone(),
    })
}

fn json(v: &Value) -> Value {
    Value::from_json(&v.to_json())
}

fn first_diff(path: &str, a: &Value, b: &Value, out: &mut Vec<String>) {
    if out.len() >= 3 {
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
        _ => {
            let s = |v: &Value| v.to_json().to_string().chars().take(200).collect::<String>();
            out.push(format!("{path}: rust={} ts={}", s(a), s(b)));
        }
    }
}

fn options_of(o: &Value) -> ForgeOptions {
    let mut options = ForgeOptions::default();
    options.disable_built_in_functions = o.get("disableBuiltInFunctions").truthy();
    options.disable_built_in_components = o.get("disableBuiltInComponents").truthy();
    if let Some(b) = o.get("basePath").as_str() {
        options.base_path = b.to_string();
    }
    if let Some(n) = o.get("maxIteratorIterations").as_f64() {
        options.max_iterator_iterations = n as usize;
    }
    options
}

/// A JSON Schema (as zod's `toJSONSchema` writes it) as a [`Schema`].
fn schema_from_json(j: &Value) -> Schema {
    let of = |k: &str| schema_from_json(&j.get(k));
    if let Some(any) = j.get("anyOf").as_array() {
        return Schema::Union(any.iter().map(schema_from_json).collect());
    }
    if !j.get("const").is_undefined() {
        return Schema::Literal(j.get("const"));
    }
    match j.get("type").as_str() {
        Some("string") => Schema::String,
        Some("number") => Schema::number(),
        Some("integer") => Schema::Number { nonnegative: false, integer: true },
        Some("boolean") => Schema::Boolean,
        Some("null") => Schema::Null,
        Some("array") => match j.get("prefixItems").as_array() {
            Some(items) => {
                let fixed: Vec<Schema> = items.iter().map(schema_from_json).collect();
                match j.get("items") {
                    Value::Object(_) => Schema::TupleRest(fixed, Box::new(of("items"))),
                    _ => Schema::Tuple(fixed),
                }
            }
            None => Schema::array(of("items")),
        },
        Some("object") => {
            let required: Vec<String> = j.get("required").as_array().map(|r| r.iter().map(Value::to_js_string).collect()).unwrap_or_default();
            let fields: Vec<(String, Schema)> = j
                .get("properties")
                .as_object()
                .map(|p| {
                    p.iter()
                        .map(|(k, v)| {
                            let s = schema_from_json(v);
                            (k.to_string(), if required.iter().any(|r| r == &**k) { s } else { Schema::optional(s) })
                        })
                        .collect()
                })
                .unwrap_or_default();
            if j.get("additionalProperties").as_bool() == Some(false) { Schema::strict_object(fields) } else { Schema::object(fields) }
        }
        _ => Schema::Any,
    }
}

/// Recorded calls of test-local functions: `(file, test, name)` -> `(arguments, result or error)`.
type Calls = HashMap<(String, String, String), Vec<(Value, Result<Value, String>)>>;

fn recorded_calls(text: &str) -> Calls {
    let mut calls: Calls = HashMap::new();
    for line in text.lines() {
        let e: Value = serde_json::from_str(line).unwrap();
        if e.get("kind").as_str() != Some("call") {
            continue;
        }
        let key = (e.get("file").to_js_string(), e.get("test").to_js_string(), e.get("name").to_js_string());
        let Some(args) = decode(&e.get("args")) else { continue };
        let result = match e.get("threw").as_str() {
            Some(m) => Err(m.to_string()),
            None => Ok(decode(&e.get("result")).unwrap_or(Value::Undefined)),
        };
        calls.entry(key).or_default().push((json(&args), result));
    }
    calls
}

/// A stand-in for a TS fixture function with no Rust port: it answers from the recorded calls.
fn replayed(function_type: &str, name: &str, schemas: &Value, calls: Arc<Mutex<Vec<(Value, Result<Value, String>)>>>) -> FunctionEntry {
    let label = name.to_string();
    let answer = move |args: Vec<Value>| -> Result<Value, ForgeError> {
        let args = json(&Value::array(args));
        let calls = calls.lock().unwrap();
        match calls.iter().find(|(a, _)| a.deep_eq(&args)) {
            Some((_, Ok(v))) => Ok(v.clone()),
            Some((_, Err(m))) => Err(ForgeError::evaluation(m.clone())),
            None => Err(ForgeError::evaluation(format!("replayed {label}: no recorded call with arguments {}", args.to_json()))),
        }
    };
    let mut entry = match function_type {
        "FunctionType.Condition" => FunctionEntry::condition(name, move |subject, rest| {
            let mut all = vec![subject.clone()];
            all.extend(rest.iter().cloned());
            answer(all).map(|v| v.truthy())
        }),
        "FunctionType.Transformer" => FunctionEntry::transformer(name, move |subject, rest| {
            let mut all = vec![subject.clone()];
            all.extend(rest.iter().cloned());
            answer(all)
        }),
        _ => FunctionEntry::generator(name, move |args| answer(args.to_vec())),
    };
    if let Value::Object(_) = schemas.get("arguments") {
        entry = entry.with_arguments(schema_from_json(&schemas.get("arguments")));
    }
    if let Value::Object(_) = schemas.get("input") {
        entry = entry.with_input(schema_from_json(&schemas.get("input")));
    }
    entry
}

fn registry_function_type(registry: &str) -> &'static str {
    match registry {
        "ConditionRegistry" => "FunctionType.Condition",
        "TransformerRegistry" => "FunctionType.Transformer",
        "GeneratorRegistry" => "FunctionType.Generator",
        _ => "FunctionType.Effect",
    }
}

/// The recorded functions and components: Rust ports of the TS fixtures where they exist,
/// replayed stand-ins for test-local conditions, transformers and generators otherwise.
fn package_of(event: &Value, journey: Value, calls: &Calls, file: &str, test: &str) -> (ForgePackage, Vec<String>) {
    let wanted: Vec<String> = event
        .get("functions")
        .as_array()
        .map(|rs| rs.iter().flat_map(|r| r.get("names").as_array().map(|n| n.iter().map(Value::to_js_string).collect::<Vec<_>>()).unwrap_or_default()).collect())
        .unwrap_or_default();
    let variants: Vec<String> = event.get("components").as_array().map(|c| c.iter().map(Value::to_js_string).collect()).unwrap_or_default();
    let available: Vec<_> = support::fixtures::functions();
    let mut functions = available.iter().filter(|f| wanted.iter().any(|n| n == &*f.name)).cloned().collect::<Vec<_>>();
    let mut missing = Vec::new();
    for registry in event.get("functions").as_array().into_iter().flat_map(|r| r.iter()) {
        let ty = registry_function_type(registry.get("type").as_str().unwrap_or_default());
        for name in registry.get("names").as_array().into_iter().flat_map(|n| n.iter()).map(Value::to_js_string) {
            if available.iter().any(|f| *f.name == *name) {
                continue;
            }
            if ty == "FunctionType.Effect" {
                missing.push(name);
                continue;
            }
            let recorded = calls.get(&(file.to_string(), test.to_string(), name.clone())).cloned().unwrap_or_default();
            functions.push(replayed(ty, &name, &registry.get("schemas").get(&name), Arc::new(Mutex::new(recorded))));
        }
    }
    let fixtures = support::fixtures::components();
    let mut components = fixtures.iter().filter(|c| variants.iter().any(|v| v == &*c.variant)).cloned().collect::<Vec<_>>();
    // Test-local components (custom TS render functions): registered as plain entries; their
    // rendered output is not compared.
    let without_render: Vec<String> =
        event.get("componentsWithoutRender").as_array().map(|c| c.iter().map(Value::to_js_string).collect()).unwrap_or_default();
    for v in &variants {
        if !fixtures.iter().any(|c| &*c.variant == v.as_str()) {
            let entry = forge_core::engine::registries::ComponentEntry::new(v);
            components.push(if without_render.contains(v) { entry } else { entry.with_render(|_, _| Ok(Value::from(""))) });
        }
    }
    let mut package = ForgePackage::new(journey).with_functions(functions).with_components(components);
    if event.get("enabled").as_bool() == Some(false) {
        package.enabled = false;
    }
    (package, missing)
}

enum Instance {
    Building(Forge),
    Client(ForgeTestClient),
}

/// Captures compilation traces only: it declines every request, so requests run untraced as in
/// the recorder (which traces compilation alone).
#[derive(Default)]
struct CompilationRecorder(Mutex<Option<serde_json::Value>>);

impl InstrumentationSink for CompilationRecorder {
    fn on_request_trace(&self, _event: &RequestTraceEvent) {}

    fn on_compilation_trace(&self, event: &CompilationTraceEvent) {
        *self.0.lock().unwrap() = Some(event.to_json());
    }

    fn should_trace(&self, _snapshot: &RequestSnapshot) -> bool {
        false
    }
}

const TIMING_KEYS: &[&str] = &["startedAtMs", "completedAtMs", "durationMs", "selfDurationMs", "executionSlices"];

/// Timings as presence, no stacks, and no `Defined at:` lines (TS source locations).
fn normalize_trace(json: &mut serde_json::Value) {
    match json {
        serde_json::Value::Object(map) => {
            map.remove("stack");
            for (k, v) in map.iter_mut() {
                if TIMING_KEYS.contains(&k.as_str()) {
                    *v = serde_json::Value::Bool(true);
                } else if k == "message"
                    && let Some(text) = v.as_str()
                {
                    *v = text.lines().filter(|l| !l.trim_start().starts_with("Defined at:")).collect::<Vec<_>>().join("\n").into();
                } else {
                    normalize_trace(v);
                }
            }
        }
        serde_json::Value::Array(items) => items.iter_mut().for_each(normalize_trace),
        _ => {}
    }
}

#[derive(Default)]
struct Tally {
    compilation_traces: usize,
    compilation_traces_ok: usize,
    registrations: usize,
    registrations_ok: usize,
    requests: usize,
    requests_ok: usize,
    unrepresentable: usize,
    missing_fixtures: HashMap<String, usize>,
    failures: Vec<String>,
}

/// Tests whose behaviour Rust cannot express, with the reason.
const NOT_REPRODUCIBLE: &[(&str, &str)] = &[
    (
        "validation contracts > should evaluate nested function arguments from left to right",
        "a TS function mutates its argument object in place (JS aliasing); Rust values are immutable",
    ),
    (
        "package registration contracts > package gate > should reject a package that was not created with createForgePackage",
        "a Rust package is always a ForgePackage; there is no unwrapped form to reject",
    ),
];

#[tokio::test]
async fn narrative_contracts_match_typescript() {
    let Some(text) = corpus() else {
        eprintln!("narrative corpus not recorded; skipping");
        return;
    };
    let calls = recorded_calls(&text);
    let mut instances: HashMap<(String, String, i64), Instance> = HashMap::new();
    let mut seen_registrations = std::collections::HashSet::new();
    let mut recorders: HashMap<(String, String, i64), Arc<CompilationRecorder>> = HashMap::new();
    let mut t = Tally::default();
    let updating = forge_core::testing::fixtures::updating();
    let mut out: Vec<serde_json::Value> = text.lines().map(|l| serde_json::from_str(l).unwrap()).collect();
    for (index, line) in text.lines().enumerate() {
        let event: Value = serde_json::from_str(line).unwrap();
        let key = (event.get("file").to_js_string(), event.get("test").to_js_string(), event.get("forge").as_f64().unwrap_or(0.0) as i64);
        let label = format!("{} > {}", key.0, key.1);
        if NOT_REPRODUCIBLE.iter().any(|(test, _)| key.1 == *test) {
            continue;
        }
        match event.get("kind").as_str() {
            Some("registerPackage") => {
                // `expect(act).toThrow(...)` repeats a failing registration (on a new Forge each
                // time); check it once.
                let mut identity = event.clone();
                identity.set("forge", Value::Undefined);
                if !updating && event.get("ok").as_bool() == Some(false) && !seen_registrations.insert(identity.to_json().to_string()) {
                    continue;
                }
                let Some(journey) = decode(&event.get("journey")) else {
                    t.unrepresentable += 1;
                    continue;
                };
                t.registrations += 1;
                let (package, missing) = package_of(&event, journey, &calls, &key.0, &key.1);
                for m in missing {
                    *t.missing_fixtures.entry(m).or_default() += 1;
                }
                let mut options = options_of(&event.get("options"));
                let recorder = recorders.entry(key.clone()).or_insert_with(|| Arc::new(CompilationRecorder::default())).clone();
                options.instrumentation = Instrumentation::new(vec![recorder.clone()]);
                let entry = instances.entry(key.clone()).or_insert_with(|| Instance::Building(Forge::new(options)));
                let Instance::Building(forge) = entry else {
                    t.failures.push(format!("{label}: registration after requests"));
                    continue;
                };
                *recorder.0.lock().unwrap() = None;
                let rust = forge.register_package(package).map(|_| ()).map_err(|e| e.to_string());
                // The compilation trace TS emitted for this registration (none when it failed
                // before compiling).
                t.compilation_traces += 1;
                let mut expected = event.get("compilationTrace").to_json();
                let mut actual = recorder.0.lock().unwrap().take().unwrap_or(serde_json::Value::Null);
                normalize_trace(&mut expected);
                normalize_trace(&mut actual);
                if updating {
                    let strict = event.get("options").get("strictRegistration").as_bool() != Some(false);
                    let record = out[index].as_object_mut().unwrap();
                    // Non-strict registration logs the failure instead of throwing: still `ok`.
                    record.insert("ok".into(), serde_json::Value::Bool(rust.is_ok() || !strict));
                    match &rust {
                        Err(e) if strict => {
                            record.insert("error".into(), serde_json::Value::String(e.clone()));
                        }
                        _ => {
                            record.remove("error");
                            record.remove("errorName");
                        }
                    }
                    if actual.is_null() {
                        record.remove("compilationTrace");
                    } else {
                        record.insert("compilationTrace".into(), actual);
                    }
                    continue;
                }
                if actual == expected {
                    t.compilation_traces_ok += 1;
                } else {
                    t.failures.push(format!("{label}: compilation trace differs\n  rust: {actual}\n  ts  : {expected}"));
                }
                let strict = event.get("options").get("strictRegistration").as_bool() != Some(false);
                match (event.get("ok").as_bool() == Some(true), rust) {
                    (true, Ok(())) => t.registrations_ok += 1,
                    (true, Err(_)) if !strict => t.registrations_ok += 1,
                    (true, Err(e)) => t.failures.push(format!("{label}: Rust rejected a registration TS accepted: {e}")),
                    (false, Ok(())) => t.failures.push(format!(
                        "{label}: Rust accepted a registration TS rejected with: {}",
                        event.get("error").to_js_string().lines().take(4).collect::<Vec<_>>().join(" | ")
                    )),
                    (false, Err(e)) => {
                        // `Defined at:` lines point at TS source locations (authoring callsites).
                        let expected = event
                            .get("error")
                            .to_js_string()
                            .lines()
                            .filter(|l| !l.trim_start().starts_with("Defined at:"))
                            .collect::<Vec<_>>()
                            .join("\n");
                        if e == expected {
                            t.registrations_ok += 1;
                        } else {
                            t.failures.push(format!("{label}: registration error differs\n  rust: {e:?}\n  ts  : {expected:?}"));
                        }
                    }
                }
            }
            Some("request") => {
                t.requests += 1;
                let Some(instance) = instances.remove(&key) else {
                    t.failures.push(format!("{label}: request without a recorded registration"));
                    continue;
                };
                let client = match instance {
                    Instance::Client(c) => c,
                    Instance::Building(forge) => ForgeTestHarness::from_forge(forge).create_client(None),
                };
                let Some(raw_options) = decode(&event.get("options")) else {
                    t.unrepresentable += 1;
                    instances.insert(key, Instance::Client(client));
                    continue;
                };
                let options = TestRequestOptions::from_value(&raw_options);
                let path = event.get("path").to_js_string();
                let result = if event.get("method").as_str() == Some("POST") {
                    client.post(&path, options).await
                } else {
                    client.get(&path, options).await
                };
                if updating {
                    let record = out[index].as_object_mut().unwrap();
                    match result {
                        Ok(r) => {
                            let mut outcome = r.to_json();
                            // Custom TS renderers cannot be replayed; their recorded output is kept.
                            outcome.set("output", event.get("outcome").get("output"));
                            record.insert("outcome".into(), json(&outcome).to_json());
                            record.insert("sessionAfter".into(), json(r.session()).to_json());
                            record.remove("threw");
                        }
                        Err(e) => {
                            record.insert("threw".into(), serde_json::Value::String(e.to_string()));
                            record.remove("outcome");
                            record.remove("sessionAfter");
                        }
                    }
                    instances.insert(key, Instance::Client(client));
                    continue;
                }
                let ok = match (result, event.get("threw").as_str()) {
                    (Err(e), Some(ts)) => e.to_string() == ts || {
                        t.failures.push(format!("{label}: {path}: both threw, messages differ: rust={e} ts={ts}"));
                        false
                    },
                    (Err(e), None) => {
                        t.failures.push(format!("{label}: {path}: Rust threw {e}"));
                        false
                    }
                    (Ok(r), Some(ts)) => {
                        t.failures.push(format!("{label}: {path}: TS threw {ts}, Rust gave {:?}", r.to_json().get("type")));
                        false
                    }
                    (Ok(r), None) => {
                        let mut expected = decode_outcome(&event.get("outcome")).unwrap_or(Value::Undefined);
                        let mut actual = r.to_json();
                        // Custom TS renderers cannot be replayed; the context they received is compared.
                        expected.set("output", Value::Undefined);
                        actual.set("output", Value::Undefined);
                        let mut diffs = Vec::new();
                        first_diff("outcome", &json(&actual), &json(&expected), &mut diffs);
                        if let Some(session) = decode(&event.get("sessionAfter")) {
                            first_diff("session", &json(r.session()), &json(&session), &mut diffs);
                        }
                        if diffs.is_empty() {
                            true
                        } else {
                            t.failures.push(format!("{label}: {} {path}\n    {}", event.get("method").to_js_string(), diffs.join("\n    ")));
                            false
                        }
                    }
                };
                if ok {
                    t.requests_ok += 1;
                }
                instances.insert(key, Instance::Client(client));
            }
            _ => {}
        }
    }
    if updating {
        forge_core::testing::fixtures::write_ndjson("narrative.ndjson", &out);
        return;
    }
    eprintln!(
        "narrative: registrations {}/{} match, compilation traces {}/{} match, requests {}/{} match, {} unrepresentable",
        t.registrations_ok, t.registrations, t.compilation_traces_ok, t.compilation_traces, t.requests_ok, t.requests, t.unrepresentable
    );
    if !t.missing_fixtures.is_empty() {
        eprintln!("  fixtures not ported: {:?}", t.missing_fixtures);
    }
    for f in t.failures.iter().take(25) {
        eprintln!("--- {f}");
    }
    let report = forge_core::testing::fixtures::report_dir().join("narrative.txt");
    let _ = std::fs::write(report, t.failures.join("\n"));
    assert!(t.failures.is_empty(), "{} narrative mismatches (see target/fixture-reports/narrative.txt)", t.failures.len());
}

