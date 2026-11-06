//! The websocket bridge (port of `DevToolsServer`, `TraceDispatcher` and `setUpForgeDevTools`).
//!
//! The server is a Forge instrumentation sink: requests carrying the devtools cookie are traced, and
//! each trace goes to the authenticated panel whose cookie it carries. Panels connect to
//! `<path>/ws` on the app's own origin, served by a Topcoat route.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use forge_core::engine::tracing::{InstrumentationSink, RequestTraceEvent};
use forge_core::framework::RequestSnapshot;
use forge_core::value::Value;
use serde_json::{json, Value as Json};
use tokio::sync::mpsc;
use topcoat::context::Cx;
use topcoat::router::content::websocket::{Message, WebSocket, WebSocketUpgrade};
use topcoat::router::request::FromRequest;
use topcoat::router::{Body, Method, Methods, Path, Route, RouteFuture, RouteId, RouterBuilder};

use crate::auth::CodeValidation;
use crate::channel::{decode_event, encode_event, RedisTraceChannel, TraceChannel};
use crate::message::{build_trace_message, extract_devtools_cookie};
use crate::session::{DevToolsSession, Outgoing, SessionState};

pub const DEFAULT_PATH: &str = "/__forge-devtools";

/// Where the bridge reports connections and auth codes (`{ info, warn }`).
pub trait DevToolsLogger: Send + Sync {
    fn info(&self, message: &str);
    fn warn(&self, message: &str);
}

/// Logs to stderr (the TS default is `console`).
pub struct StderrLogger;

impl DevToolsLogger for StderrLogger {
    fn info(&self, message: &str) {
        eprintln!("{message}");
    }

    fn warn(&self, message: &str) {
        eprintln!("{message}");
    }
}

/// `ForgeDevToolsOptions`.
pub struct ForgeDevToolsOptions {
    /// Where the websocket lives (`<path>/ws`); defaults to `/__forge-devtools`.
    pub path: String,
    pub logger: Arc<dyn DevToolsLogger>,
    /// Skips the auth code prompt. Local development only.
    pub no_auth: bool,
    /// A Redis URL (`redis://` / `rediss://`) for apps running more than one instance: traces go
    /// through the app's Redis so the instance holding a panel's websocket sees every instance's.
    pub redis_url: Option<String>,
    /// A custom transport in place of Redis (takes precedence over `redis_url`).
    pub trace_channel: Option<Arc<dyn TraceChannel>>,
}

impl Default for ForgeDevToolsOptions {
    fn default() -> Self {
        Self {
            path: DEFAULT_PATH.into(),
            logger: Arc::new(StderrLogger),
            no_auth: false,
            redis_url: None,
            trace_channel: None,
        }
    }
}

/// `setUpForgeDevTools`: create once, register as a Forge instrumentation sink and mount its route.
/// An invalid Redis URL is logged and the bridge runs in single-instance mode.
pub fn set_up_forge_devtools(mut options: ForgeDevToolsOptions) -> DevToolsServer {
    if options.trace_channel.is_none()
        && let Some(url) = options.redis_url.as_deref()
    {
        match RedisTraceChannel::new(url, options.logger.clone()) {
            Ok(channel) => options.trace_channel = Some(Arc::new(channel)),
            Err(e) => options.logger.warn(&format!("Forge DevTools Redis channel failed to connect: {e}")),
        }
    }
    DevToolsServer::new(options)
}

type SharedSession = Arc<Mutex<DevToolsSession>>;

struct Inner {
    web_socket_path: String,
    logger: Arc<dyn DevToolsLogger>,
    no_auth: bool,
    sessions: Mutex<Vec<SharedSession>>,
    channel: Option<Arc<dyn TraceChannel>>,
    channel_started: AtomicBool,
}

#[derive(Clone)]
pub struct DevToolsServer {
    inner: Arc<Inner>,
}

/// `normalizeWebSocketPath`.
fn normalize_web_socket_path(path: &str) -> String {
    let path = path.strip_suffix('/').unwrap_or(path);
    if path.starts_with('/') { format!("{path}/ws") } else { format!("/{path}/ws") }
}

impl DevToolsServer {
    pub fn new(options: ForgeDevToolsOptions) -> Self {
        Self {
            inner: Arc::new(Inner {
                web_socket_path: normalize_web_socket_path(&options.path),
                logger: options.logger,
                no_auth: options.no_auth,
                sessions: Mutex::new(Vec::new()),
                channel: options.trace_channel,
                channel_started: AtomicBool::new(false),
            }),
        }
    }

    /// The websocket path (`<path>/ws`).
    pub fn web_socket_path(&self) -> &str {
        &self.inner.web_socket_path
    }

    /// `attach`: adds the websocket route to a router.
    pub fn mount(&self, builder: RouterBuilder) -> RouterBuilder {
        self.start_channel();
        self.inner.logger.info(&format!("Forge DevTools WebSocket server attached at {}", self.inner.web_socket_path));
        let path: &'static str = Box::leak(self.inner.web_socket_path.clone().into_boxed_str());
        builder.route(DevToolsRoute { id: RouteId::new(), path: Path::new(path), server: self.clone() })
    }

    /// `startRedisChannel`: subscribes once; everything heard is dispatched like a local trace.
    pub fn start_channel(&self) {
        let Some(channel) = &self.inner.channel else { return };
        if self.inner.channel_started.swap(true, Ordering::SeqCst) {
            return;
        }
        let server = self.clone();
        channel.start(Arc::new(move |payload: Vec<u8>| match decode_event(&payload) {
            Ok(event) => server.dispatch(&event),
            // A malformed or truncated message must never take the listener down.
            Err(e) => server.inner.logger.warn(&format!("Forge DevTools Redis dropped a malformed trace: {e}")),
        }));
    }

    /// `close`: disconnects every panel and stops the channel.
    pub fn close(&self) {
        for session in self.inner.sessions.lock().unwrap().drain(..) {
            session.lock().unwrap().close();
        }
        if let Some(channel) = &self.inner.channel {
            channel.close();
        }
    }

    /// Number of connected panels.
    pub fn session_count(&self) -> usize {
        self.inner.sessions.lock().unwrap().len()
    }

    /// `TraceDispatcher.onRequestTrace`: forward to authenticated panels whose cookie the request carries.
    pub fn dispatch(&self, event: &RequestTraceEvent) {
        let cookie = extract_devtools_cookie(&event.snapshot());
        let message = serde_json::to_string(&build_trace_message(event).to_json()).unwrap_or_default();
        for session in self.inner.sessions.lock().unwrap().iter() {
            let session = session.lock().unwrap();
            if session.state() == SessionState::Authenticated && session.cookie_value() == cookie.as_deref() {
                session.send_text(message.clone());
            }
        }
    }

    fn log_code_issued(&self, session: &DevToolsSession) {
        let minutes = session.code_expires_in_ms().div_ceil(60_000);
        self.inner.logger.info(&format!(
            "DevTools client {} \u{2014} auth code: \x1b[1m{}\x1b[0m (expires in {minutes}m)",
            session.id(),
            session.code()
        ));
    }

    /// Registers a connected panel and returns it with its outgoing frames.
    pub fn connect(&self) -> (SharedSession, mpsc::UnboundedReceiver<Outgoing>) {
        let (tx, rx) = mpsc::unbounded_channel();
        let mut session = DevToolsSession::new(tx);
        if self.inner.no_auth {
            session.authenticate_immediately();
            self.inner.logger.info(&format!("DevTools client {} connected (auth disabled)", session.id()));
        } else {
            self.log_code_issued(&session);
            session.send_challenge();
        }
        let session = Arc::new(Mutex::new(session));
        self.inner.sessions.lock().unwrap().push(session.clone());
        (session, rx)
    }

    /// Handles one client frame (`ws.on('message')`).
    pub fn handle_client_message(&self, session: &SharedSession, raw: &str) {
        let Ok(message) = serde_json::from_str::<Json>(raw) else { return };
        let mut session = session.lock().unwrap();
        match message.get("type").and_then(Json::as_str) {
            Some("heartbeat:ping") => session.send(&json!({ "type": "heartbeat:pong" })),
            Some("auth:code") => {
                if let Some(code) = message.get("code").and_then(Json::as_str).filter(|c| !c.is_empty())
                    && session.handle_auth_code(code) == CodeValidation::Valid
                {
                    self.inner.logger.info(&format!("DevTools client {} authenticated", session.id()));
                }
            }
            Some("auth:refresh") => {
                session.refresh_code();
                self.log_code_issued(&session);
            }
            _ => {}
        }
    }

    /// `ws.on('close')`.
    pub fn disconnect(&self, session: &SharedSession) {
        self.inner.sessions.lock().unwrap().retain(|s| !Arc::ptr_eq(s, session));
        self.inner.logger.info(&format!("DevTools client {} disconnected", session.lock().unwrap().id()));
    }

    async fn run_socket(self, mut socket: WebSocket) {
        let (session, mut outgoing) = self.connect();
        loop {
            tokio::select! {
                frame = outgoing.recv() => match frame {
                    Some(Outgoing::Text(text)) => {
                        if socket.send(Message::text(text)).await.is_err() {
                            break;
                        }
                    }
                    Some(Outgoing::Close) | None => break,
                },
                incoming = socket.recv() => match incoming {
                    Some(Ok(Message::Text(text))) => self.handle_client_message(&session, text.as_str()),
                    Some(Ok(Message::Binary(bytes))) => {
                        if let Ok(text) = std::str::from_utf8(&bytes) {
                            self.handle_client_message(&session, text);
                        }
                    }
                    Some(Ok(Message::Close(_))) | Some(Err(_)) | None => break,
                    Some(Ok(_)) => {}
                },
            }
        }
        let _ = socket.close().await;
        self.disconnect(&session);
    }
}

impl InstrumentationSink for DevToolsServer {
    fn on_request_trace(&self, event: &RequestTraceEvent) {
        match &self.inner.channel {
            None => self.dispatch(event),
            // Channel mode has one delivery path: publish even our own traces and hear them back
            // through the subscription, like every other instance's.
            Some(channel) => channel.publish(encode_event(event)),
        }
    }

    /// Only requests carrying a devtools cookie are traced at all.
    fn should_trace(&self, snapshot: &RequestSnapshot) -> bool {
        let view = Value::from_pairs([("cookies", snapshot.cookies.clone()), ("headers", snapshot.headers.clone())]);
        extract_devtools_cookie(&view).is_some()
    }
}

/// The websocket endpoint.
struct DevToolsRoute {
    id: RouteId,
    path: &'static Path,
    server: DevToolsServer,
}

impl Route for DevToolsRoute {
    fn id(&self) -> RouteId {
        self.id
    }

    fn methods(&self) -> Methods<'_> {
        Methods::Only(&[Method::GET])
    }

    fn path(&self) -> &Path {
        self.path
    }

    fn handle<'cx>(&'cx self, cx: &'cx Cx, body: Body) -> RouteFuture<'cx> {
        Box::pin(async move {
            let upgrade = WebSocketUpgrade::from_request(cx, body).await?;
            let server = self.server.clone();
            upgrade.on_upgrade(move |socket| server.run_socket(socket))
        })
    }
}
