//! The trace channel: TS wire-format interop and the server's channel mode (port of the
//! `RedisTraceChannel` / `DevToolsServer` channel tests), plus a live Redis check when
//! `FORGE_DEVTOOLS_REDIS_URL` is set.

use std::sync::{Arc, Mutex};
use std::time::Duration;

use forge_core::engine::tracing::{InstrumentationSink, RequestTraceEvent};
use forge_core::Value;
use forge_devtools::channel::Deliver;
use forge_devtools::session::Outgoing;
use forge_devtools::{
    decode_event, encode_event, set_up_forge_devtools, DevToolsLogger, DevToolsServer, ForgeDevToolsOptions, TraceChannel,
};
use serde_json::{json, Value as Json};

#[derive(Default)]
struct Log(Mutex<Vec<String>>);

impl DevToolsLogger for Log {
    fn info(&self, _message: &str) {}
    fn warn(&self, message: &str) {
        self.0.lock().unwrap().push(message.to_string());
    }
}

#[derive(Default)]
struct FakeChannel {
    published: Mutex<Vec<Vec<u8>>>,
    deliver: Mutex<Option<Deliver>>,
    starts: Mutex<usize>,
    closed: Mutex<bool>,
}

impl TraceChannel for FakeChannel {
    fn publish(&self, payload: Vec<u8>) {
        self.published.lock().unwrap().push(payload);
    }
    fn start(&self, deliver: Deliver) {
        *self.starts.lock().unwrap() += 1;
        *self.deliver.lock().unwrap() = Some(deliver);
    }
    fn close(&self) {
        *self.closed.lock().unwrap() = true;
    }
}

impl FakeChannel {
    fn hear(&self, payload: Vec<u8>) {
        let deliver = self.deliver.lock().unwrap().clone().expect("started");
        deliver(payload);
    }
}

fn event(cookie: &str) -> RequestTraceEvent {
    RequestTraceEvent(Value::from_json(&json!({
        "snapshot": {
            "nodeId": "journey::step", "method": "GET",
            "location": { "origin": "http://localhost", "href": "http://localhost/step", "pathname": "/step", "basePath": "" },
            "params": {}, "query": {}, "post": {}, "headers": {}, "cookies": { "__forgeDevtools": cookie }, "state": {}, "session": {}
        },
        "trace": { "outcome": "render", "startedAtMs": 0, "phases": [] }
    })))
}

fn traces(rx: &mut tokio::sync::mpsc::UnboundedReceiver<Outgoing>) -> Vec<Json> {
    let mut out = Vec::new();
    while let Ok(Outgoing::Text(t)) = rx.try_recv() {
        let message: Json = serde_json::from_str(&t).unwrap();
        if message["type"] == "trace" {
            out.push(message);
        }
    }
    out
}

fn authenticated(server: &DevToolsServer) -> (String, tokio::sync::mpsc::UnboundedReceiver<Outgoing>) {
    let (session, rx) = server.connect();
    let cookie = session.lock().unwrap().cookie_value().unwrap().to_string();
    (cookie, rx)
}

#[test]
fn decodes_the_ts_wire_format() {
    let payload = std::fs::read(concat!(env!("CARGO_MANIFEST_DIR"), "/tests/fixtures/ts-trace.json.gz")).unwrap();
    let event = decode_event(&payload).expect("gzipSync(JSON.stringify(event)) from TS");
    assert_eq!(event.snapshot().get("location").get("pathname").as_str(), Some("/scaffold/step"));
    let round_trip = decode_event(&encode_event(&event)).unwrap();
    assert_eq!(round_trip.to_json(), event.to_json());
    assert!(decode_event(b"not gzip").is_err());
}

#[test]
fn channel_mode_publishes_and_dispatches_what_it_hears() {
    let channel = Arc::new(FakeChannel::default());
    let log = Arc::new(Log::default());
    let server = set_up_forge_devtools(ForgeDevToolsOptions {
        no_auth: true,
        logger: log.clone(),
        trace_channel: Some(channel.clone()),
        ..Default::default()
    });
    let (cookie, mut rx) = authenticated(&server);
    server.start_channel();
    server.start_channel();
    assert_eq!(*channel.starts.lock().unwrap(), 1, "subscribes once");

    // Own traces are published, not dispatched locally.
    server.on_request_trace(&event(&cookie));
    assert!(traces(&mut rx).is_empty());
    let published = channel.published.lock().unwrap().clone();
    assert_eq!(published.len(), 1);

    // What the channel delivers (from any instance) is dispatched by cookie.
    channel.hear(published[0].clone());
    channel.hear(encode_event(&event("another-panel")));
    let delivered = traces(&mut rx);
    assert_eq!(delivered.len(), 1);
    assert_eq!(delivered[0]["pathname"], "/step");

    // Malformed messages are logged and dropped.
    channel.hear(b"garbage".to_vec());
    assert!(log.0.lock().unwrap()[0].starts_with("Forge DevTools Redis dropped a malformed trace"));

    server.close();
    assert!(*channel.closed.lock().unwrap());
}

#[test]
fn an_invalid_redis_url_falls_back_to_local_dispatch() {
    let log = Arc::new(Log::default());
    let server = set_up_forge_devtools(ForgeDevToolsOptions {
        no_auth: true,
        logger: log.clone(),
        redis_url: Some("not a url".into()),
        ..Default::default()
    });
    let (cookie, mut rx) = authenticated(&server);
    server.on_request_trace(&event(&cookie));
    assert_eq!(traces(&mut rx).len(), 1);
    assert!(log.0.lock().unwrap()[0].starts_with("Forge DevTools Redis channel failed to connect"));
}

/// Two instances on one Redis: a trace evaluated on B reaches the panel connected to A.
#[tokio::test(flavor = "multi_thread")]
async fn redis_carries_traces_between_instances() {
    let Ok(url) = std::env::var("FORGE_DEVTOOLS_REDIS_URL") else {
        eprintln!("FORGE_DEVTOOLS_REDIS_URL not set; skipping");
        return;
    };
    let instance = || {
        set_up_forge_devtools(ForgeDevToolsOptions {
            no_auth: true,
            logger: Arc::new(Log::default()),
            redis_url: Some(url.clone()),
            ..Default::default()
        })
    };
    let (a, b) = (instance(), instance());
    a.start_channel();
    b.start_channel();
    let (cookie, mut rx) = authenticated(&a);
    tokio::time::sleep(Duration::from_millis(300)).await; // subscriptions settle
    b.on_request_trace(&event(&cookie));
    b.on_request_trace(&event("someone-else"));
    let mut delivered = Vec::new();
    for _ in 0..50 {
        delivered.extend(traces(&mut rx));
        if !delivered.is_empty() {
            break;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    tokio::time::sleep(Duration::from_millis(200)).await;
    delivered.extend(traces(&mut rx));
    assert_eq!(delivered.len(), 1, "exactly the panel's own trace, via Redis");
    assert_eq!(delivered[0]["pathname"], "/step");
    a.close();
    b.close();
}

/// Redis being down only loses traces: publishing never blocks or fails, and failures are logged.
#[tokio::test(flavor = "multi_thread")]
async fn redis_down_is_logged_and_swallowed() {
    let log = Arc::new(Log::default());
    let server = set_up_forge_devtools(ForgeDevToolsOptions {
        no_auth: true,
        logger: log.clone(),
        redis_url: Some("redis://127.0.0.1:1".into()),
        ..Default::default()
    });
    server.start_channel();
    server.on_request_trace(&event("c"));
    for _ in 0..40 {
        if log.0.lock().unwrap().iter().any(|m| m.contains("failed to connect")) {
            break;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    assert!(log.0.lock().unwrap().iter().any(|m| m.starts_with("Forge DevTools Redis channel failed to connect")));
    server.close();
}

/// `rediss://` (`REDIS_TLS_ENABLED=true`) needs a rustls crypto provider: connecting must fail with
/// a logged connection error, not a provider panic.
#[tokio::test(flavor = "multi_thread")]
async fn tls_urls_have_a_crypto_provider() {
    let log = Arc::new(Log::default());
    let server = set_up_forge_devtools(ForgeDevToolsOptions {
        no_auth: true,
        logger: log.clone(),
        redis_url: Some("rediss://127.0.0.1:1".into()),
        ..Default::default()
    });
    server.start_channel();
    server.on_request_trace(&event("c"));
    for _ in 0..40 {
        if !log.0.lock().unwrap().is_empty() {
            break;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    let logged = log.0.lock().unwrap().clone();
    assert!(logged.iter().any(|m| m.starts_with("Forge DevTools Redis channel failed to connect")), "{logged:?}");
    server.close();
}
