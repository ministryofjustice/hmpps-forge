//! The panel's wire format (port of `TraceMessageBuilder`).

use forge_core::engine::tracing::RequestTraceEvent;
use forge_core::value::{Map, Value};

/// `TraceMessageBuilder.build`: one `{ type: 'trace', ... }` message for the panel.
pub fn build_trace_message(event: &RequestTraceEvent) -> Value {
    let snapshot = event.snapshot();
    let trace = event.trace();
    let outcome = trace.get("outcome");
    let phases: Vec<Value> = items(&trace.get("phases"))
        .into_iter()
        .map(|phase| {
            let mut map = Map::new();
            map.insert("phase".into(), phase.get("phase"));
            map.insert("outcome".into(), outcome.clone());
            map.insert("durationMs".into(), or_zero(phase.get("durationMs")));
            map.insert("startedAtMs".into(), phase.get("startedAtMs"));
            map.insert("completedAtMs".into(), phase.get("completedAtMs"));
            map.insert("units".into(), Value::array(items(&phase.get("units")).iter().map(build_unit).collect()));
            Value::object(map)
        })
        .collect();

    let mut trace_message = Map::new();
    trace_message.insert("outcome".into(), outcome.clone());
    trace_message.insert("durationMs".into(), or_zero(trace.get("durationMs")));
    trace_message.insert("startedAtMs".into(), trace.get("startedAtMs"));
    for key in ["redirect", "error", "reachability"] {
        let value = trace.get(key);
        if value.truthy() {
            trace_message.insert(key.into(), value);
        }
    }
    trace_message.insert("phases".into(), Value::array(phases));

    let route = event.route();
    let pick = |key: &str, fallback: Value| match route.get(key) {
        v if v.is_nullish() => fallback,
        v => v,
    };
    let route_message = Value::from_pairs([
        ("journeyCode", pick("journeyCode", snapshot.get("nodeId"))),
        ("journeyTitle", pick("journeyTitle", snapshot.get("nodeId"))),
        ("stepTitle", route.get("stepTitle")),
        ("routeTemplatePath", pick("routeTemplatePath", snapshot.get("location").get("pathname"))),
    ]);
    let request = Value::from_pairs(
        ["params", "query", "post", "state", "headers", "cookies", "session"].map(|k| (k, snapshot.get(k))),
    );
    Value::from_pairs([
        ("type", Value::from("trace")),
        ("method", snapshot.get("method")),
        ("nodeId", snapshot.get("nodeId")),
        ("pathname", snapshot.get("location").get("pathname")),
        ("trace", Value::object(trace_message)),
        ("route", route_message),
        ("request", request),
    ])
}

fn or_zero(v: Value) -> Value {
    if v.is_nullish() { Value::Number(0.0) } else { v }
}

fn items(v: &Value) -> Vec<Value> {
    v.as_array().map(|a| a.iter().cloned().collect()).unwrap_or_default()
}

/// `buildUnit`.
fn build_unit(unit: &Value) -> Value {
    if unit.get("kind").as_str() == Some("context-snapshot") {
        let snapshot = Value::from_pairs(["answers", "data", "reachabilityValidities", "reachability"].map(|k| (k, unit.get(k))));
        return Value::from_pairs([
            ("kind", unit.get("kind")),
            ("name", unit.get("key")),
            ("snapshot", snapshot),
            ("children", Value::array(vec![])),
        ]);
    }
    // `{ ...beginFields, ...completeFields }` with `properties` split out.
    let mut fields = Map::new();
    for source in ["beginFields", "completeFields"] {
        if let Some(map) = unit.get(source).as_object() {
            for (k, v) in map.iter() {
                fields.insert(k.clone(), v.clone());
            }
        }
    }
    let properties = fields.shift_remove("properties").unwrap_or_default();
    let first_string = |names: &[&str]| {
        names.iter().map(|n| fields.get(*n).cloned().unwrap_or_default()).find(|v| v.as_str().is_some()).unwrap_or_default()
    };
    let mut map = Map::new();
    map.insert("kind".into(), unit.get("kind"));
    for key in ["durationMs", "selfDurationMs", "startedAtMs", "completedAtMs", "executionSlices"] {
        map.insert(key.into(), unit.get(key));
    }
    map.insert("nodeId".into(), first_string(&["nodeId", "id", "stepId", "currentStepId"]));
    map.insert("variant".into(), first_string(&["variant", "mode", "stage", "blockType", "outcome"]));
    map.insert("name".into(), first_string(&["name", "code"]));
    if matches!(properties, Value::Object(_) | Value::Opaque(_)) {
        map.insert("properties".into(), properties);
    }
    if !fields.is_empty() {
        map.insert("fields".into(), Value::object(fields));
    }
    map.insert("children".into(), Value::array(items(&unit.get("children")).iter().map(build_unit).collect()));
    Value::object(map)
}

/// Name of the cookie that scopes traces to one panel.
pub const DEVTOOLS_COOKIE_NAME: &str = "__forgeDevtools";

/// `extractDevToolsCookie`: the parsed cookie, else the raw `Cookie` header.
pub fn extract_devtools_cookie(snapshot: &Value) -> Option<String> {
    if let Some(v) = snapshot.get("cookies").get(DEVTOOLS_COOKIE_NAME).as_str().filter(|v| !v.is_empty()) {
        return Some(v.to_string());
    }
    let raw = snapshot.get("headers").get("cookie");
    let prefix = format!("{DEVTOOLS_COOKIE_NAME}=");
    raw.as_str()?.split(';').map(str::trim_start).find_map(|s| s.strip_prefix(prefix.as_str())).map(str::to_string)
}
