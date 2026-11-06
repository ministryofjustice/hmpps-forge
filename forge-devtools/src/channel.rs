//! Carrying traces between app replicas (port of `trace/RedisTraceChannel.ts`).
//!
//! With replicas behind a load balancer the panel's websocket lands on one instance while page
//! requests fan out across all of them. In channel mode every instance publishes its traces and
//! whichever instance holds a panel's websocket hears them all and forwards by cookie as usual.
//!
//! The payload is the gzipped JSON of the `RequestTraceEvent` on `__forgeDevtools:traces`, as in
//! TS. Redis being down only means missing traces: every failure is logged and swallowed.

use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use flate2::Compression;
use forge_core::engine::tracing::RequestTraceEvent;
use forge_core::Value;
use futures::StreamExt;
use tokio::sync::mpsc;
use tokio::task::JoinHandle;

use crate::server::DevToolsLogger;

pub const TRACE_CHANNEL: &str = "__forgeDevtools:traces";

/// Receives payloads heard on the channel (this instance's own included).
pub type Deliver = Arc<dyn Fn(Vec<u8>) + Send + Sync>;

/// A pub/sub transport for encoded traces.
pub trait TraceChannel: Send + Sync {
    /// Publishes one payload; never blocks the request and never fails it.
    fn publish(&self, payload: Vec<u8>);
    /// Starts listening (called once, when the bridge is mounted).
    fn start(&self, deliver: Deliver);
    fn close(&self);
}

/// `gzipSync(JSON.stringify(event))`.
pub fn encode_event(event: &RequestTraceEvent) -> Vec<u8> {
    let json = serde_json::to_vec(&event.to_json()).unwrap_or_default();
    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    let _ = encoder.write_all(&json);
    encoder.finish().unwrap_or_default()
}

/// `JSON.parse(gunzipSync(message))`.
pub fn decode_event(payload: &[u8]) -> Result<RequestTraceEvent, String> {
    let mut json = Vec::new();
    GzDecoder::new(payload).read_to_end(&mut json).map_err(|e| e.to_string())?;
    let value: serde_json::Value = serde_json::from_slice(&json).map_err(|e| e.to_string())?;
    if !value.is_object() {
        return Err("trace payload is not an object".into());
    }
    Ok(RequestTraceEvent(Value::from_json(&value)))
}

/// node-redis' reconnect strategy in the app: 20ms doubling, capped at 30s.
fn backoff(attempt: u32) -> Duration {
    Duration::from_millis((20u64.saturating_mul(1 << attempt.min(16))).min(30_000))
}

/// The Redis transport. Publishing and subscribing use their own connections (a subscribed
/// connection cannot issue other commands); both reconnect on their own.
pub struct RedisTraceChannel {
    client: redis::Client,
    logger: Arc<dyn DevToolsLogger>,
    queue: mpsc::UnboundedSender<Vec<u8>>,
    pending: Mutex<Option<mpsc::UnboundedReceiver<Vec<u8>>>>,
    tasks: Mutex<Vec<JoinHandle<()>>>,
}

impl RedisTraceChannel {
    /// `url` is a `redis://` or `rediss://` URL (credentials included).
    pub fn new(url: &str, logger: Arc<dyn DevToolsLogger>) -> Result<Self, String> {
        let client = redis::Client::open(url).map_err(|e| e.to_string())?;
        let (queue, pending) = mpsc::unbounded_channel();
        Ok(Self { client, logger, queue, pending: Mutex::new(Some(pending)), tasks: Mutex::new(Vec::new()) })
    }

    async fn run_publisher(client: redis::Client, logger: Arc<dyn DevToolsLogger>, mut queue: mpsc::UnboundedReceiver<Vec<u8>>) {
        let mut connection: Option<redis::aio::ConnectionManager> = None;
        while let Some(payload) = queue.recv().await {
            if connection.is_none() {
                match client.get_connection_manager().await {
                    Ok(c) => connection = Some(c),
                    Err(e) => {
                        logger.warn(&format!("Forge DevTools Redis channel failed to connect: {e}"));
                        continue;
                    }
                }
            }
            let Some(conn) = connection.as_mut() else { continue };
            let result: redis::RedisResult<i64> = redis::cmd("PUBLISH").arg(TRACE_CHANNEL).arg(payload).query_async(conn).await;
            if let Err(e) = result {
                logger.warn(&format!("Forge DevTools Redis publish failed: {e}"));
            }
        }
    }

    async fn run_subscriber(client: redis::Client, logger: Arc<dyn DevToolsLogger>, deliver: Deliver) {
        let mut attempt = 0;
        loop {
            match client.get_async_pubsub().await {
                Ok(mut pubsub) => match pubsub.subscribe(TRACE_CHANNEL).await {
                    Ok(()) => {
                        attempt = 0;
                        let mut messages = pubsub.on_message();
                        while let Some(message) = messages.next().await {
                            deliver(message.get_payload_bytes().to_vec());
                        }
                        logger.warn("Forge DevTools Redis subscribe failed: subscription connection closed");
                    }
                    Err(e) => logger.warn(&format!("Forge DevTools Redis subscribe failed: {e}")),
                },
                Err(e) => logger.warn(&format!("Forge DevTools Redis channel failed to connect: {e}")),
            }
            tokio::time::sleep(backoff(attempt)).await;
            attempt += 1;
        }
    }
}

impl TraceChannel for RedisTraceChannel {
    fn publish(&self, payload: Vec<u8>) {
        let _ = self.queue.send(payload);
    }

    fn start(&self, deliver: Deliver) {
        let Some(queue) = self.pending.lock().unwrap().take() else { return };
        let Ok(runtime) = tokio::runtime::Handle::try_current() else {
            self.logger.warn("Forge DevTools Redis channel failed to connect: no Tokio runtime");
            return;
        };
        let mut tasks = self.tasks.lock().unwrap();
        tasks.push(runtime.spawn(Self::run_publisher(self.client.clone(), self.logger.clone(), queue)));
        tasks.push(runtime.spawn(Self::run_subscriber(self.client.clone(), self.logger.clone(), deliver)));
    }

    fn close(&self) {
        for task in self.tasks.lock().unwrap().drain(..) {
            task.abort();
        }
    }
}
