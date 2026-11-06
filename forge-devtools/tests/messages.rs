//! The devtools wire message (`build_trace_message`, the format the Chrome panel consumes) for every
//! recorded trace in `fixtures/traces.ndjson`, against the recorded messages (first built by the
//! TS `TraceMessageBuilder`). `UPDATE_FIXTURES=1` rewrites the messages from the stored traces.

use forge_core::Value;
use forge_core::engine::tracing::RequestTraceEvent;
use forge_core::testing::fixtures;
use forge_devtools::build_trace_message;
use serde_json::Value as Json;

#[test]
fn messages_match_recorded() {
    let Some(corpus) = fixtures::read("traces.ndjson") else {
        eprintln!("trace fixture missing; skipping");
        return;
    };
    let updating = fixtures::updating();
    let (mut total, mut mismatched, mut updated) = (0, Vec::new(), Vec::new());
    for line in corpus.lines().filter(|l| !l.trim().is_empty()) {
        let mut entry: Json = serde_json::from_str(line).unwrap();
        let traces = entry["traces"].as_array().cloned().expect("traces");
        let built: Vec<Json> =
            traces.iter().map(|t| build_trace_message(&RequestTraceEvent(Value::from_json(t))).to_json()).collect();
        if updating {
            entry["messages"] = Json::Array(built);
            updated.push(entry);
            continue;
        }
        let expected = entry["messages"].as_array().cloned().unwrap_or_default();
        total += built.len();
        if built.len() != expected.len() {
            mismatched.push(format!("{} :: {}: {} messages, expected {}", entry["file"], entry["name"], built.len(), expected.len()));
            continue;
        }
        for (actual, expected) in built.iter().zip(&expected) {
            if actual != expected {
                mismatched.push(format!("{} :: {}\n  got     ={actual}\n  expected={expected}", entry["file"], entry["name"]));
            }
        }
    }
    if updating {
        fixtures::write_ndjson("traces.ndjson", &updated);
        return;
    }
    assert!(mismatched.is_empty(), "{}/{total} messages differ:\n{}", mismatched.len(), mismatched[..mismatched.len().min(3)].join("\n"));
    eprintln!("devtools messages: {total}/{total} identical");
}
