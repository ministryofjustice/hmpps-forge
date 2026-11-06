//! Replays every recorded built-in function call (`fixtures/builtins.<TZ>.ndjson`, first recorded
//! from the TS unit tests) against the built-ins, per timezone. `UPDATE_FIXTURES=1` rewrites the
//! expected results from this implementation.

use forge_core::Value;
use forge_core::builtins;
use forge_core::engine::registries::FunctionRegistry;
use forge_core::jsdate::{as_date, JsDate};
use forge_core::value::Map;

/// Calls whose results depend on the wall clock at recording time.
const TIME_DEPENDENT: &[&str] = &["Date.Now", "Date.Today", "Date.IsToday", "Date.IsFutureDate", "Date.IsPastDate"];

/// Decodes the recorder's tagged JSON, rebuilding shared references (`$id`/`$ref`) so `===`
/// identity matches the TS call. `None` for values Rust cannot represent.
fn decode(v: &Value, ids: &mut std::collections::HashMap<i64, Value>) -> Option<Value> {
    let Value::Object(o) = v else {
        return Some(match v {
            Value::Array(a) => Value::array(a.iter().map(|x| decode(x, ids)).collect::<Option<Vec<_>>>()?),
            other => other.clone(),
        });
    };
    if o.contains_key("$undefined") {
        return Some(Value::Undefined);
    }
    if let Some(Value::Number(r)) = o.get("$ref") {
        return ids.get(&(*r as i64)).cloned();
    }
    if let Some(Value::String(n)) = o.get("$number") {
        return Some(Value::Number(match n.as_ref() {
            "NaN" => f64::NAN,
            "Infinity" => f64::INFINITY,
            _ => f64::NEG_INFINITY,
        }));
    }
    if o.contains_key("$regexp") || o.contains_key("$unsupported") {
        return None;
    }
    let id = o.get("$id").and_then(Value::as_f64).map(|n| n as i64);
    let decoded = if let Some(Value::String(d)) = o.get("$date") {
        if d.as_ref() == "Invalid Date" { JsDate::invalid().value() } else { JsDate::parse(d).value() }
    } else if let Some(Value::Array(items)) = o.get("$array") {
        Value::array(items.iter().map(|x| decode(x, ids)).collect::<Option<Vec<_>>>()?)
    } else {
        let mut map = Map::new();
        for (k, x) in o.iter().filter(|(k, _)| k.as_ref() != "$id") {
            map.insert(k.clone(), decode(x, ids)?);
        }
        Value::object(map)
    };
    if let Some(id) = id {
        ids.insert(id, decoded.clone());
    }
    Some(decoded)
}

/// Encodes a Rust value the way the recorder encodes JS values.
fn encode(v: &Value) -> Value {
    if let Some(d) = as_date(v) {
        return Value::from_pairs([("$date", Value::from(d.to_iso_string().unwrap_or_else(|| "Invalid Date".into())))]);
    }
    match v {
        Value::Undefined => Value::from_pairs([("$undefined", Value::Bool(true))]),
        Value::Number(n) if !n.is_finite() => {
            Value::from_pairs([("$number", Value::from(forge_core::value::number_to_js_string(*n)))])
        }
        Value::Array(a) => Value::array(a.iter().map(encode).collect()),
        Value::Object(o) => Value::object(o.iter().map(|(k, x)| (k.clone(), encode(x))).collect()),
        Value::Opaque(o) => encode(&o.view()),
        other => other.clone(),
    }
}

#[tokio::test]
async fn builtins_match_typescript() {
    let tz = std::env::var("TZ").unwrap_or_else(|_| "local".into()).replace('/', "_");
    let name = format!("builtins.{tz}.ndjson");
    let Some(text) = forge_core::testing::fixtures::read(&name) else {
        eprintln!("built-in corpus not recorded; skipping");
        return;
    };
    let mut registry = FunctionRegistry::new();
    registry.register_all(builtins::functions()).unwrap();

    let (mut checked, mut skipped) = (0, 0);
    let mut failures = Vec::new();
    let updating = forge_core::testing::fixtures::updating();
    let mut updated: Vec<serde_json::Value> = Vec::new();
    for line in text.lines() {
        let mut row: Value = serde_json::from_str(line).unwrap();
        let fn_name = row.get("name").to_js_string();
        let entry = registry.get(&fn_name);
        let args = decode(&row.get("args"), &mut Default::default());
        let (Some(entry), Some(Value::Array(args)), false) = (entry, args, TIME_DEPENDENT.contains(&fn_name.as_str())) else {
            skipped += 1;
            updated.push(row.to_json());
            continue;
        };
        checked += 1;
        let result = entry.call(args.to_vec()).await;
        if updating {
            let map = row.as_object_mut().unwrap();
            map.shift_remove("ok");
            map.shift_remove("error");
            match &result {
                Ok(v) => row.set("ok", encode(v)),
                Err(e) => row.set(
                    "error",
                    Value::from_pairs([
                        ("name", Value::from(if e.is_type_error() { "TypeError" } else { "Error" })),
                        ("message", Value::from(e.to_string())),
                    ]),
                ),
            }
            updated.push(row.to_json());
            continue;
        }
        let name = fn_name;
        let expected_error = row.get("error");
        match (result, expected_error.is_undefined()) {
            (Ok(v), true) => {
                let got = encode(&v);
                let expected = decode(&row.get("ok"), &mut Default::default()).map(|e| encode(&e)).unwrap_or_default();
                if !got.deep_eq(&expected) {
                    failures.push(format!("{name}{:?}: rust={got:?} ts={:?}", row.get("args"), row.get("ok")));
                }
            }
            (Ok(v), false) => failures.push(format!("{name}{:?}: rust ok {:?}, ts threw {:?}", row.get("args"), encode(&v), expected_error)),
            (Err(e), true) => failures.push(format!("{name}{:?}: rust threw {e}, ts={:?}", row.get("args"), row.get("ok"))),
            (Err(e), false) => {
                let ts_message = expected_error.get("message").to_js_string();
                let ts_type = expected_error.get("name").as_str() == Some("TypeError");
                // Zod's error text after the em dash is not reproduced; compare the prefix.
                let comparable = |m: &str| m.split(" — ").next().unwrap_or(m).to_string();
                if e.is_type_error() != ts_type || comparable(&e.to_string()) != comparable(&ts_message) {
                    failures.push(format!(
                        "{name}{:?}: rust error {:?} ({}) != ts {:?} ({})",
                        row.get("args"),
                        e.to_string(),
                        if e.is_type_error() { "TypeError" } else { "Error" },
                        ts_message,
                        expected_error.get("name")
                    ));
                }
            }
        }
    }
    if updating {
        forge_core::testing::fixtures::write_ndjson(&name, &updated);
        return;
    }
    eprintln!("built-ins: {} checked, {} skipped, {} failed", checked, skipped, failures.len());
    for f in failures.iter().take(60) {
        eprintln!("  {f}");
    }
    assert!(failures.is_empty(), "{} built-in calls differ from TS", failures.len());
}
