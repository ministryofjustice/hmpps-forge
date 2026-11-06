//! Ports of the TS devtools server tests (auth codes, sessions, cookie-scoped dispatch).

use std::sync::{Arc, Mutex};

use forge_core::engine::runtime::context::RequestLocation;
use forge_core::engine::tracing::{InstrumentationSink, RequestTraceEvent};
use forge_core::framework::{HttpMethod, RequestSnapshot};
use forge_core::Value;
use forge_devtools::auth::{generate_code_at, validate_code_at, CodeValidation};
use forge_devtools::session::Outgoing;
use forge_devtools::{extract_devtools_cookie, DevToolsLogger, DevToolsServer, ForgeDevToolsOptions};
use serde_json::{json, Value as Json};
use tokio::sync::mpsc::UnboundedReceiver;

#[derive(Default)]
struct Log(Mutex<Vec<String>>);

impl DevToolsLogger for Log {
    fn info(&self, message: &str) {
        self.0.lock().unwrap().push(message.to_string());
    }
    fn warn(&self, message: &str) {
        self.0.lock().unwrap().push(message.to_string());
    }
}

fn server(no_auth: bool) -> (DevToolsServer, Arc<Log>) {
    let log = Arc::new(Log::default());
    let server = DevToolsServer::new(ForgeDevToolsOptions { no_auth, logger: log.clone(), ..Default::default() });
    (server, log)
}

fn drain(rx: &mut UnboundedReceiver<Outgoing>) -> Vec<Json> {
    let mut out = Vec::new();
    while let Ok(Outgoing::Text(t)) = rx.try_recv() {
        out.push(serde_json::from_str(&t).unwrap());
    }
    out
}

fn snapshot(cookies: Value, headers: Value) -> RequestSnapshot {
    RequestSnapshot {
        node_id: "journey::compile_ast:1".into(),
        method: HttpMethod::Get,
        location: RequestLocation { origin: "http://localhost".into(), href: "http://localhost/a".into(), pathname: "/a".into(), base_path: "/a".into() },
        params: Value::empty_object(),
        query: Value::empty_object(),
        post: Value::empty_object(),
        headers,
        cookies,
        state: Value::empty_object(),
        session: Value::empty_object(),
    }
}

fn event(cookie: Option<&str>) -> RequestTraceEvent {
    let cookies = match cookie {
        Some(c) => Value::from_pairs([("__forgeDevtools", Value::from(c))]),
        None => Value::empty_object(),
    };
    let snapshot = forge_core::engine::tracing::snapshot_value(&snapshot(cookies, Value::empty_object()));
    RequestTraceEvent(Value::from_pairs([
        ("snapshot", snapshot),
        ("trace", Value::from_json(&json!({ "outcome": "render", "startedAtMs": 1, "durationMs": 2, "phases": [] }))),
    ]))
}

#[test]
fn auth_codes() {
    let mut code = generate_code_at(1_000);
    assert_eq!(code.code.len(), 5);
    assert!(code.code.chars().all(|c| c.is_ascii_uppercase() || c.is_ascii_digit()));
    assert_eq!(code.expires_at, 301_000);
    assert_eq!(code.attempts, 0);
    let real = code.code.clone();
    assert_eq!(validate_code_at(&mut code.clone(), &real.to_lowercase(), 1_000), CodeValidation::Valid);
    assert_eq!(validate_code_at(&mut code, "?????", 1_000), CodeValidation::Invalid);
    assert_eq!(validate_code_at(&mut code, "?????", 1_000), CodeValidation::Invalid);
    assert_eq!(validate_code_at(&mut code, "?????", 1_000), CodeValidation::MaxAttempts);
    assert_eq!(validate_code_at(&mut code, &real, 1_000), CodeValidation::MaxAttempts);
    assert_eq!(validate_code_at(&mut generate_code_at(0), "x", 300_001), CodeValidation::Expired);
}

#[test]
fn cookie_extraction() {
    let parsed = Value::from_json(&json!({ "cookies": { "__forgeDevtools": "abc" }, "headers": {} }));
    assert_eq!(extract_devtools_cookie(&parsed).as_deref(), Some("abc"));
    let raw = Value::from_json(&json!({ "cookies": {}, "headers": { "cookie": "a=1; __forgeDevtools=xyz; b=2" } }));
    assert_eq!(extract_devtools_cookie(&raw).as_deref(), Some("xyz"));
    let none = Value::from_json(&json!({ "cookies": {}, "headers": { "cookie": "a=1" } }));
    assert_eq!(extract_devtools_cookie(&none), None);
}

#[test]
fn challenge_then_code_then_traces_scoped_to_cookie() {
    let (server, log) = server(false);
    let (session, mut rx) = server.connect();
    let challenge = drain(&mut rx);
    assert_eq!(challenge[0]["type"], "auth:challenge");
    assert!(challenge[0]["expiresIn"].as_u64().unwrap() > 290_000);
    let code = session.lock().unwrap().code().to_string();
    assert!(log.0.lock().unwrap()[0].contains(&code), "code is logged to the terminal");

    // Traces are not forwarded before authentication.
    server.on_request_trace(&event(None));
    assert!(drain(&mut rx).is_empty());

    server.handle_client_message(&session, r#"{"type":"auth:code","code":"WRONG"}"#);
    assert_eq!(drain(&mut rx), vec![json!({ "type": "auth:failed", "attemptsRemaining": 2 })]);

    server.handle_client_message(&session, &json!({ "type": "auth:code", "code": code.to_lowercase() }).to_string());
    let success = drain(&mut rx);
    assert_eq!(success[0]["type"], "auth:success");
    let cookie = success[0]["cookie"].as_str().unwrap().to_string();
    assert_eq!(cookie.len(), 64);

    server.on_request_trace(&event(Some("someone-else")));
    assert!(drain(&mut rx).is_empty(), "other panels' traces are not forwarded");
    server.on_request_trace(&event(Some(&cookie)));
    let traces = drain(&mut rx);
    assert_eq!(traces.len(), 1);
    assert_eq!(traces[0]["type"], "trace");
    assert_eq!(traces[0]["pathname"], "/a");

    server.handle_client_message(&session, r#"{"type":"heartbeat:ping"}"#);
    assert_eq!(drain(&mut rx), vec![json!({ "type": "heartbeat:pong" })]);
    server.handle_client_message(&session, "not json");
    assert!(drain(&mut rx).is_empty());

    server.disconnect(&session);
    assert_eq!(server.session_count(), 0);
}

#[test]
fn rejection_and_refresh() {
    let (server, _) = server(false);
    let (session, mut rx) = server.connect();
    drain(&mut rx);
    for _ in 0..2 {
        server.handle_client_message(&session, r#"{"type":"auth:code","code":"WRONG"}"#);
    }
    server.handle_client_message(&session, r#"{"type":"auth:code","code":"WRONG"}"#);
    assert_eq!(drain(&mut rx).last().unwrap()["type"], "auth:rejected");
    let code = session.lock().unwrap().code().to_string();
    server.handle_client_message(&session, &json!({ "type": "auth:code", "code": code }).to_string());
    assert_eq!(drain(&mut rx), vec![json!({ "type": "auth:rejected" })], "no auth after rejection without refresh");

    server.handle_client_message(&session, r#"{"type":"auth:refresh"}"#);
    assert_eq!(drain(&mut rx)[0]["type"], "auth:challenge");
    let code = session.lock().unwrap().code().to_string();
    server.handle_client_message(&session, &json!({ "type": "auth:code", "code": code }).to_string());
    assert_eq!(drain(&mut rx)[0]["type"], "auth:success");
}

#[test]
fn no_auth_issues_a_cookie_immediately() {
    let (server, log) = server(true);
    let (_session, mut rx) = server.connect();
    let first = drain(&mut rx);
    assert_eq!(first[0]["type"], "auth:success");
    assert!(log.0.lock().unwrap()[0].ends_with("connected (auth disabled)"));
}

#[test]
fn should_trace_requires_the_cookie() {
    let (server, _) = server(false);
    let with = snapshot(Value::from_pairs([("__forgeDevtools", Value::from("c"))]), Value::empty_object());
    let raw = snapshot(Value::empty_object(), Value::from_pairs([("cookie", Value::from("__forgeDevtools=c"))]));
    let without = snapshot(Value::empty_object(), Value::empty_object());
    assert!(server.should_trace(&with));
    assert!(server.should_trace(&raw));
    assert!(!server.should_trace(&without));
    assert_eq!(server.web_socket_path(), "/__forge-devtools/ws");
}
