//! Topcoat adapter for Forge (port of `forge-express-nunjucks`'s router, handler and snapshot
//! factory): every node in the Forge topology becomes a Topcoat [`Route`].
//!
//! ```no_run
//! # use std::sync::Arc;
//! # fn demo(forge: forge_core::Forge, renderer: Arc<dyn forge_core::engine::concerns::render::Renderer>) {
//! let router = forge_topcoat::mount(
//!     topcoat::router::Router::builder(),
//!     Arc::new(forge),
//!     renderer,
//!     forge_topcoat::AdapterOptions::default(),
//! )
//! .build();
//! # }
//! ```

use std::borrow::Cow;
use std::collections::HashMap;
use std::hash::{BuildHasher, Hasher};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

use forge_core::engine::concerns::render::Renderer;
use forge_core::engine::mount::ForgeRoute;
use forge_core::engine::runtime::context::RequestLocation;
use forge_core::framework::{CookieOptions, HttpMethod, OutcomeKind, RecordingResponse, RequestSnapshot};
use forge_core::route_path::resolve_path_params;
use forge_core::value::{Map, Value};
use forge_core::Forge;
use topcoat::context::Cx;
use topcoat::router::{
    request, response::Response, to_bytes, Body, Method, Methods, Path, Route, RouteFuture, RouteId, RouterBuilder, StatusCode,
};

/// Where sessions live between requests (Express uses `express-session`).
pub trait SessionStore: Send + Sync {
    fn load(&self, id: &str) -> Option<Value>;
    fn save(&self, id: &str, session: Value);
}

/// An in-process session store, for development and tests.
#[derive(Default)]
pub struct MemorySessionStore(Mutex<HashMap<String, Value>>);

impl SessionStore for MemorySessionStore {
    fn load(&self, id: &str) -> Option<Value> {
        self.0.lock().unwrap().get(id).cloned()
    }

    fn save(&self, id: &str, session: Value) {
        self.0.lock().unwrap().insert(id.to_string(), session);
    }
}

/// Renders an error page: `(status, message, request state)` to HTML.
pub type ErrorPage = Arc<dyn Fn(u16, &str, &Value) -> String + Send + Sync>;

/// What a [`RequestStateFn`] sees of the request.
#[derive(Clone, Debug)]
pub struct RequestInfo {
    pub method: Method,
    pub uri: http::Uri,
    pub headers: http::HeaderMap,
    pub cookies: Value,
    pub session: Value,
}

/// Per-request state (Express middleware setting `res.locals` / `req.state`): called for every
/// Forge request; the object it returns is merged over [`AdapterOptions::state`].
pub type RequestStateFn =
    Arc<dyn Fn(RequestInfo) -> std::pin::Pin<Box<dyn std::future::Future<Output = Value> + Send>> + Send + Sync>;

#[derive(Clone)]
pub struct AdapterOptions {
    pub sessions: Arc<dyn SessionStore>,
    pub session_cookie: String,
    /// Request state shared with templates and effects (Express `app.locals`/`res.locals`).
    pub state: Value,
    /// Synchronizer-token CSRF protection (`csrf-sync`): a token per session, exposed to
    /// templates as `csrfToken` and required as the `_csrf` field of every POST.
    pub csrf: bool,
    /// Headers added to every Forge response. `{nonce}` in a value is replaced with the
    /// request's CSP nonce when `csp_nonce` is on.
    pub headers: Vec<(http::HeaderName, http::HeaderValue)>,
    /// A fresh nonce per request, exposed to templates as `cspNonce` (helmet's `res.locals.cspNonce`).
    pub csp_nonce: bool,
    /// Error pages for engine errors and error outcomes; plain text when unset.
    pub error_page: Option<ErrorPage>,
    /// Per-request state merged over `state` (see [`AdapterOptions::with_request_state`]).
    pub request_state: Option<RequestStateFn>,
}

impl AdapterOptions {
    /// Computes state for each request (the user, feature flags, a client for the user's
    /// credentials, ...), merged over `state`. Keys it returns win over `state`; `csrfToken` and
    /// `cspNonce` are set after it.
    pub fn with_request_state<F, Fut>(mut self, f: F) -> Self
    where
        F: Fn(RequestInfo) -> Fut + Send + Sync + 'static,
        Fut: std::future::Future<Output = Value> + Send + 'static,
    {
        self.request_state = Some(Arc::new(move |info| Box::pin(f(info))));
        self
    }
}

impl Default for AdapterOptions {
    fn default() -> Self {
        Self {
            sessions: Arc::new(MemorySessionStore::default()),
            session_cookie: "forge.sid".into(),
            state: Value::empty_object(),
            csrf: false,
            headers: vec![],
            csp_nonce: false,
            error_page: None,
            request_state: None,
        }
    }
}

struct Shared {
    forge: Arc<Forge>,
    renderer: Arc<dyn Renderer>,
    options: AdapterOptions,
}

/// One Forge node mounted as a Topcoat route.
pub struct ForgeTopcoatRoute {
    id: RouteId,
    methods: &'static [Method],
    path: Cow<'static, Path>,
    route: ForgeRoute,
    shared: Arc<Shared>,
}

/// Forge `:param` template paths become Topcoat `{param}` paths.
fn to_topcoat_path(template: &str) -> String {
    let converted: Vec<String> = template
        .split('/')
        .map(|s| match s.strip_prefix(':') {
            Some(name) => format!("{{{name}}}"),
            None => s.to_string(),
        })
        .collect();
    let joined = converted.join("/");
    if joined.is_empty() { "/".into() } else { joined }
}

/// Mounts every node of `forge`'s topology on `builder`.
pub fn mount(builder: RouterBuilder, forge: Arc<Forge>, renderer: Arc<dyn Renderer>, options: AdapterOptions) -> RouterBuilder {
    let shared = Arc::new(Shared { forge: forge.clone(), renderer, options });
    let mut builder = builder;
    // A journey whose first step has the path "/" shares that step's URL. Express keeps the
    // first matching route; Topcoat rejects duplicates, so later routes for a mounted path are
    // skipped. The topology lists a package's steps before its journeys, so the step wins.
    let mut mounted = std::collections::HashSet::new();
    for route in forge.topology() {
        let topcoat_path = to_topcoat_path(&route.template_path);
        if !mounted.insert(topcoat_path.clone()) {
            continue;
        }
        let methods: &'static [Method] = if route.methods.contains(&"POST") { &[Method::GET, Method::POST] } else { &[Method::GET] };
        // Routes live for the process; leaking the path gives Topcoat its `'static` pattern.
        let path: &'static str = Box::leak(topcoat_path.into_boxed_str());
        builder = builder.route(ForgeTopcoatRoute {
            id: RouteId::new(),
            methods,
            path: Cow::Borrowed(Path::new(path)),
            route,
            shared: shared.clone(),
        });
    }
    builder
}

impl Route for ForgeTopcoatRoute {
    fn id(&self) -> RouteId {
        self.id
    }

    fn methods(&self) -> Methods<'_> {
        Methods::Only(self.methods)
    }

    fn path(&self) -> &Path {
        &self.path
    }

    fn handle<'cx>(&'cx self, cx: &'cx Cx, body: Body) -> RouteFuture<'cx> {
        Box::pin(async move { Ok(self.serve(cx, body).await) })
    }
}

fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'+' => out.push(b' '),
            b'%' if i + 2 < bytes.len() => {
                match u8::from_str_radix(std::str::from_utf8(&bytes[i + 1..i + 3]).unwrap_or("zz"), 16) {
                    Ok(b) => {
                        out.push(b);
                        i += 2;
                    }
                    Err(_) => out.push(b'%'),
                }
            }
            b => out.push(b),
        }
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// Sets `value` at a `qs`-style key path (`a[b][]`, `a[0]`), merging repeats into arrays.
fn qs_insert(target: &mut Value, path: &[String], value: Value) {
    let Some((head, rest)) = path.split_first() else { return };
    if rest.is_empty() {
        let existing = target.get(head);
        let merged = match existing {
            Value::Undefined => value,
            Value::Array(a) => {
                let mut items = (*a).clone();
                items.push(value);
                Value::array(items)
            }
            other => Value::array(vec![other, value]),
        };
        set_key(target, head, merged);
        return;
    }
    if rest[0].is_empty() {
        // `a[]=x`: append to an array.
        let mut items = target.get(head).as_array().map(|a| (**a).clone()).unwrap_or_default();
        items.push(value);
        set_key(target, head, Value::array(items));
        return;
    }
    let mut child = match target.get(head) {
        v @ (Value::Object(_) | Value::Array(_)) => v,
        _ if rest[0].bytes().all(|b| b.is_ascii_digit()) => Value::array(vec![]),
        _ => Value::empty_object(),
    };
    qs_insert(&mut child, rest, value);
    set_key(target, head, child);
}

fn set_key(target: &mut Value, key: &str, value: Value) {
    match target {
        Value::Array(a) => {
            let items = std::sync::Arc::make_mut(a);
            if let Ok(i) = key.parse::<usize>() {
                while items.len() <= i {
                    items.push(Value::Undefined);
                }
                items[i] = value;
            }
        }
        _ => target.set(key, value),
    }
}

/// `qs.parse`, as Express's extended query and urlencoded body parsers do.
pub fn parse_qs(input: &str) -> Value {
    let mut out = Value::empty_object();
    for pair in input.split('&').filter(|p| !p.is_empty()) {
        let (k, v) = pair.split_once('=').unwrap_or((pair, ""));
        let key = percent_decode(k);
        let value = Value::from(percent_decode(v));
        let mut path = Vec::new();
        match key.find('[') {
            Some(i) if key.ends_with(']') => {
                path.push(key[..i].to_string());
                path.extend(key[i + 1..key.len() - 1].split("][").map(str::to_string));
            }
            _ => path.push(key),
        }
        qs_insert(&mut out, &path, value);
    }
    out
}

fn parse_cookies(header: Option<&str>) -> Value {
    let mut map = Map::new();
    for part in header.unwrap_or_default().split(';') {
        if let Some((k, v)) = part.trim().split_once('=') {
            map.insert(k.trim().into(), Value::from(percent_decode(v.trim())));
        }
    }
    Value::object(map)
}

fn new_session_id() -> String {
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    let mut hasher = std::collections::hash_map::RandomState::new().build_hasher();
    hasher.write_u64(COUNTER.fetch_add(1, Ordering::Relaxed));
    hasher.write_u128(std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_nanos());
    let a = hasher.finish();
    hasher.write_u64(a);
    format!("{a:016x}{:016x}", hasher.finish())
}

/// Matches `/a/:id` against a concrete path, returning the params.
fn match_params(template: &str, path: &str) -> Value {
    let mut map = Map::new();
    for (t, p) in template.split('/').zip(path.split('/')) {
        if let Some(name) = t.strip_prefix(':') {
            map.insert(name.into(), Value::from(percent_decode(p)));
        }
    }
    Value::object(map)
}

fn cookie_header(name: &str, value: &str, options: Option<&CookieOptions>) -> String {
    let mut out = format!("{name}={value}; Path={}", options.and_then(|o| o.path.clone()).unwrap_or_else(|| "/".into()));
    if let Some(o) = options {
        if let Some(max_age) = o.max_age {
            out += &format!("; Max-Age={}", (max_age / 1000.0).floor());
        }
        if let Some(d) = &o.domain {
            out += &format!("; Domain={d}");
        }
        if o.http_only == Some(true) {
            out += "; HttpOnly";
        }
        if o.secure == Some(true) {
            out += "; Secure";
        }
        if let Some(s) = &o.same_site {
            let s = match s.as_str() {
                "strict" => "Strict",
                "lax" => "Lax",
                _ => "None",
            };
            out += &format!("; SameSite={s}");
        }
    }
    out
}

fn error_response(options: &AdapterOptions, status: StatusCode, message: &str, state: &Value) -> Response {
    match &options.error_page {
        Some(page) => {
            let mut r = Response::new(Body::from(page(status.as_u16(), message, state)));
            *r.status_mut() = status;
            r.headers_mut().insert(http::header::CONTENT_TYPE, http::HeaderValue::from_static("text/html; charset=utf-8"));
            r
        }
        None => text_response(status, message),
    }
}

fn text_response(status: StatusCode, message: &str) -> Response {
    let mut r = Response::new(Body::from(message.to_string()));
    *r.status_mut() = status;
    r.headers_mut().insert(http::header::CONTENT_TYPE, http::HeaderValue::from_static("text/plain; charset=utf-8"));
    r
}

impl ForgeTopcoatRoute {
    async fn serve(&self, cx: &Cx, body: Body) -> Response {
        let shared = &self.shared;
        let uri = request::uri(cx).clone();
        let headers = request::headers(cx).clone();
        let method = if request::method(cx) == Method::POST { HttpMethod::Post } else { HttpMethod::Get };
        let pathname = uri.path().to_string();
        let params = match_params(&self.route.template_path, &pathname);

        let post = if method == HttpMethod::Post {
            let content_type = headers.get(http::header::CONTENT_TYPE).and_then(|v| v.to_str().ok()).unwrap_or_default();
            if !content_type.starts_with("application/x-www-form-urlencoded") {
                return text_response(StatusCode::UNSUPPORTED_MEDIA_TYPE, "Unsupported request body type");
            }
            match to_bytes(body, 1024 * 1024).await {
                Ok(bytes) => parse_qs(&String::from_utf8_lossy(&bytes)),
                Err(_) => return text_response(StatusCode::BAD_REQUEST, "Could not read request body"),
            }
        } else {
            Value::empty_object()
        };

        let cookie_header_value = headers.get(http::header::COOKIE).and_then(|v| v.to_str().ok()).map(str::to_string);
        let cookies = parse_cookies(cookie_header_value.as_deref());
        let session_id = cookies.get(&shared.options.session_cookie).as_str().map(str::to_string);
        let (session_id, is_new) = match session_id {
            Some(id) => (id, false),
            None => (new_session_id(), true),
        };
        let mut session = shared.options.sessions.load(&session_id).unwrap_or_else(Value::empty_object);
        // Express sessions expose their id; the pattern effects key stored answers by it.
        session.set("id", Value::from(session_id.as_str()));
        let mut state = shared.options.state.clone();
        if let Some(request_state) = &shared.options.request_state {
            let info = RequestInfo {
                method: request::method(cx).clone(),
                uri: uri.clone(),
                headers: headers.clone(),
                cookies: cookies.clone(),
                session: session.clone(),
            };
            if let Some(extra) = request_state(info).await.as_object() {
                if state.as_object().is_none() {
                    state = Value::empty_object();
                }
                for (k, v) in extra.iter() {
                    state.set(k.clone(), v.clone());
                }
            }
        }
        let nonce = shared.options.csp_nonce.then(|| new_session_id()[..32].to_string());
        if let Some(n) = &nonce {
            state.set("cspNonce", Value::from(n.as_str()));
        }
        if shared.options.csrf {
            let token = match session.get("csrfToken") {
                Value::String(t) => t.to_string(),
                _ => {
                    let t = new_session_id();
                    session.set("csrfToken", Value::from(t.as_str()));
                    shared.options.sessions.save(&session_id, session.clone());
                    t
                }
            };
            if method == HttpMethod::Post && post.get("_csrf").as_str() != Some(token.as_str()) {
                return self.finish(
                    error_response(&shared.options, StatusCode::FORBIDDEN, "invalid csrf token", &state),
                    &[],
                    is_new,
                    &session_id,
                    nonce.as_deref(),
                );
            }
            state.set("csrfToken", Value::from(token));
        }

        let mut header_map = Map::new();
        for (name, value) in headers.iter() {
            header_map.insert(name.as_str().into(), Value::from(value.to_str().unwrap_or_default()));
        }
        let host = headers.get(http::header::HOST).and_then(|v| v.to_str().ok()).unwrap_or("localhost");
        let origin = format!("http://{host}");
        let path_and_query = uri.path_and_query().map_or_else(|| pathname.clone(), |p| p.as_str().to_string());
        let snapshot = RequestSnapshot {
            node_id: self.route.node_id.as_str().into(),
            method,
            location: RequestLocation {
                href: format!("{origin}{path_and_query}"),
                pathname: pathname.clone(),
                base_path: resolve_path_params(&self.route.base_path, &params),
                origin,
            },
            params,
            query: uri.query().map_or_else(Value::empty_object, parse_qs),
            post,
            headers: Value::object(header_map),
            cookies,
            state: state.clone(),
            session,
        };

        let recording = Arc::new(RecordingResponse::default());
        let result = shared.forge.execute_with_renderer(&snapshot, recording.clone(), shared.renderer.clone()).await;
        let response = match result {
            Err(e) => {
                let status = e.status().and_then(|s| StatusCode::from_u16(s).ok()).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
                error_response(&shared.options, status, &e.to_string(), &state)
            }
            Ok(outcome) => {
                shared.options.sessions.save(&session_id, outcome.session.clone());
                match outcome.kind {
                    OutcomeKind::Navigate { url } => {
                        let mut r = Response::new(Body::empty());
                        *r.status_mut() = StatusCode::FOUND;
                        if let Ok(v) = http::HeaderValue::from_str(&url) {
                            r.headers_mut().insert(http::header::LOCATION, v);
                        }
                        r
                    }
                    OutcomeKind::Error(e) => error_response(
                        &shared.options,
                        StatusCode::from_u16(e.status).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR),
                        &e.message,
                        &state,
                    ),
                    OutcomeKind::Render { output: Some(html), .. } => {
                        let mut r = Response::new(Body::from(html.to_js_string()));
                        r.headers_mut()
                            .insert(http::header::CONTENT_TYPE, http::HeaderValue::from_static("text/html; charset=utf-8"));
                        r
                    }
                    OutcomeKind::Render { output: None, .. } => {
                        text_response(StatusCode::INTERNAL_SERVER_ERROR, "Render outcome produced no output - renderer not bound")
                    }
                }
            }
        };
        let mut extra: Vec<(http::HeaderName, http::HeaderValue)> = Vec::new();
        for (name, value) in recording.headers.lock().unwrap().iter() {
            if let (Ok(n), Ok(v)) = (http::HeaderName::try_from(name.as_str()), http::HeaderValue::from_str(value)) {
                extra.push((n, v));
            }
        }
        for (name, cookie) in recording.cookies.lock().unwrap().iter() {
            if let Ok(v) = http::HeaderValue::from_str(&cookie_header(name, &cookie.value, cookie.options.as_ref())) {
                extra.push((http::header::SET_COOKIE, v));
            }
        }
        self.finish(response, &extra, is_new, &session_id, nonce.as_deref())
    }

    /// Applies configured headers, the engine's headers and cookies, and a new session cookie.
    fn finish(
        &self,
        mut response: Response,
        extra: &[(http::HeaderName, http::HeaderValue)],
        is_new: bool,
        session_id: &str,
        nonce: Option<&str>,
    ) -> Response {
        let options = &self.shared.options;
        let headers_out = response.headers_mut();
        for (n, v) in &options.headers {
            let value = match (nonce, v.to_str()) {
                (Some(nonce), Ok(text)) if text.contains("{nonce}") => {
                    http::HeaderValue::from_str(&text.replace("{nonce}", nonce)).unwrap_or_else(|_| v.clone())
                }
                _ => v.clone(),
            };
            headers_out.insert(n.clone(), value);
        }
        for (n, v) in extra {
            if n == http::header::SET_COOKIE {
                headers_out.append(n.clone(), v.clone());
            } else {
                headers_out.insert(n.clone(), v.clone());
            }
        }
        if is_new && let Ok(v) = http::HeaderValue::from_str(&format!("{}={session_id}; Path=/; HttpOnly; SameSite=Lax", options.session_cookie)) {
            headers_out.append(http::header::SET_COOKIE, v);
        }
        response
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use forge_core::val;

    #[test]
    fn qs_parsing_matches_express_extended() {
        assert_eq!(
            parse_qs("name=Ada+Lovelace&dob%5Bday%5D=1&dob[month]=2&tags[]=a&tags[]=b&x=1&x=2"),
            val!({"name": "Ada Lovelace", "dob": {"day": "1", "month": "2"}, "tags": ["a", "b"], "x": ["1", "2"]})
        );
        assert_eq!(to_topcoat_path("/a/:id/b"), "/a/{id}/b");
    }
}
