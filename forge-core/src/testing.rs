//! Testing utilities (port of `forge-core/src/testing`): a harness that registers packages on a
//! [`Forge`] and a client that sends requests to its routes without a web framework, returning
//! [`TestResult`]s.
//!
//! ```no_run
//! # async fn demo(journey: forge_core::Value) -> forge_core::engine::errors::ForgeResult<()> {
//! use forge_core::testing::{ForgeTestHarness, TestRequestOptions};
//! let mut harness = ForgeTestHarness::new(Default::default());
//! harness.register_package(forge_core::ForgePackage::new(journey))?;
//! let client = harness.create_client(None);
//! let result = client.post("/apply/name", TestRequestOptions::body(forge_core::val!({ "name": "Ada" }))).await?;
//! assert_eq!(result.redirect_url(), Some("/apply/done"));
//! # Ok(()) }
//! ```

use std::sync::Arc;

use crate::engine::concerns::render::Renderer;
use crate::engine::errors::{ForgeError, ForgeResult};
use crate::engine::mount::ForgeRoute;
use crate::engine::registries::{ComponentEntry, FunctionEntry};
use crate::engine::runtime::context::{EffectContext, HookType, RequestLocation, SharedContext};
use crate::framework::{CookieMutation, HttpMethod, OutcomeKind, RecordingResponse, RequestSnapshot};
use crate::route_path::resolve_path_params;
use crate::value::{Map, Value};
use crate::{Forge, ForgeOptions, ForgePackage};

/// `ForgeTestHarness`: a [`Forge`] to register components, functions and packages on.
pub struct ForgeTestHarness {
    forge: Forge,
}

impl ForgeTestHarness {
    pub fn new(options: ForgeOptions) -> Self {
        Self { forge: Forge::new(options) }
    }

    /// A harness over an existing Forge.
    pub fn from_forge(forge: Forge) -> Self {
        Self { forge }
    }

    pub fn register_global_components(&mut self, components: impl IntoIterator<Item = ComponentEntry>) -> ForgeResult<&mut Self> {
        self.forge.register_global_components(components)?;
        Ok(self)
    }

    pub fn register_global_functions(&mut self, functions: impl IntoIterator<Item = FunctionEntry>) -> ForgeResult<&mut Self> {
        self.forge.register_global_functions(functions)?;
        Ok(self)
    }

    pub fn register_package(&mut self, package: ForgePackage) -> ForgeResult<&mut Self> {
        self.forge.register_package(package)?;
        Ok(self)
    }

    pub fn forge(&self) -> &Forge {
        &self.forge
    }

    /// A client over this harness's Forge; `renderer` renders pages (`output`) when given.
    pub fn create_client(self, renderer: Option<Arc<dyn Renderer>>) -> ForgeTestClient {
        ForgeTestClient { forge: Arc::new(self.forge), renderer }
    }
}

/// `TestRequestOptions`: everything about a request except its method and path.
#[derive(Clone, Debug, Default)]
pub struct TestRequestOptions {
    pub headers: Value,
    pub cookies: Value,
    pub params: Value,
    pub query: Value,
    pub body: Value,
    pub session: Value,
    pub state: Value,
}

impl TestRequestOptions {
    pub fn body(body: Value) -> Self {
        Self { body, ..Self::default() }
    }

    pub fn session(session: Value) -> Self {
        Self { session, ..Self::default() }
    }

    pub fn with_session(self, session: Value) -> Self {
        Self { session, ..self }
    }

    /// From the TS options object shape (`{ headers, cookies, params, query, body, session, state }`).
    pub fn from_value(v: &Value) -> Self {
        Self {
            headers: v.get("headers"),
            cookies: v.get("cookies"),
            params: v.get("params"),
            query: v.get("query"),
            body: v.get("body"),
            session: v.get("session"),
            state: v.get("state"),
        }
    }
}

/// `TestResult`.
#[derive(Clone, Debug)]
pub enum TestResult {
    Render { context: Value, output: Option<Value>, headers: Map, cookies: Vec<(String, CookieMutation)>, session: Value },
    Redirect { url: String, headers: Map, cookies: Vec<(String, CookieMutation)>, session: Value },
    Error { status: Option<u16>, message: String, headers: Map, cookies: Vec<(String, CookieMutation)>, session: Value },
}

impl TestResult {
    pub fn redirect_url(&self) -> Option<&str> {
        match self {
            TestResult::Redirect { url, .. } => Some(url),
            _ => None,
        }
    }

    pub fn context(&self) -> Option<&Value> {
        match self {
            TestResult::Render { context, .. } => Some(context),
            _ => None,
        }
    }

    /// The session after the request (TS tests observe the mutated session object).
    pub fn session(&self) -> &Value {
        match self {
            TestResult::Render { session, .. } | TestResult::Redirect { session, .. } | TestResult::Error { session, .. } => session,
        }
    }

    /// `getBlocksByVariant`.
    pub fn blocks_by_variant(&self, variant: &str) -> Vec<Value> {
        let Some(blocks) = self.context().map(|c| c.get("blocks")) else { return vec![] };
        blocks.as_array().map(|b| b.iter().filter(|b| b.get("variant").as_str() == Some(variant)).cloned().collect()).unwrap_or_default()
    }

    /// `getValidationErrorsByFieldCode`.
    pub fn validation_errors_for(&self, field_code: &str) -> Vec<Value> {
        let Some(errors) = self.context().map(|c| c.get("fieldValidationErrors")) else { return vec![] };
        errors.as_array().map(|e| e.iter().filter(|e| e.get("blockCode").as_str() == Some(field_code)).cloned().collect()).unwrap_or_default()
    }

    /// The result in the shape the TS exporters record (`{ type, url | status, message | context, headers }`).
    pub fn to_json(&self) -> Value {
        let cookies_json = |cookies: &[(String, CookieMutation)]| {
            Value::object(
                cookies
                    .iter()
                    .map(|(k, c)| {
                        let mut m = Value::from_pairs([("value", Value::from(c.value.as_str()))]);
                        m.set("options", c.options.as_ref().map_or(Value::Undefined, cookie_options_json));
                        (k.as_str().into(), m)
                    })
                    .collect(),
            )
        };
        match self {
            TestResult::Redirect { url, headers, cookies, .. } => Value::from_pairs([
                ("type", Value::from("redirect")),
                ("url", Value::from(url.as_str())),
                ("headers", Value::object(headers.clone())),
                ("cookies", cookies_json(cookies)),
            ]),
            TestResult::Error { status, message, headers, cookies, .. } => Value::from_pairs([
                ("type", Value::from("error")),
                ("status", status.map_or(Value::Undefined, |s| Value::from(i64::from(s)))),
                ("message", Value::from(message.as_str())),
                ("headers", Value::object(headers.clone())),
                ("cookies", cookies_json(cookies)),
            ]),
            TestResult::Render { context, output, headers, cookies, .. } => Value::from_pairs([
                ("type", Value::from("render")),
                ("context", context.clone()),
                ("output", output.clone().unwrap_or(Value::Undefined)),
                ("headers", Value::object(headers.clone())),
                ("cookies", cookies_json(cookies)),
            ]),
        }
    }
}

fn cookie_options_json(o: &crate::framework::CookieOptions) -> Value {
    let mut m = Map::new();
    let mut put = |k: &str, v: Value| {
        if !v.is_undefined() {
            m.insert(k.into(), v);
        }
    };
    put("maxAge", o.max_age.map_or(Value::Undefined, Value::Number));
    put("expires", o.expires.clone().map_or(Value::Undefined, Value::from));
    put("httpOnly", o.http_only.map_or(Value::Undefined, Value::Bool));
    put("secure", o.secure.map_or(Value::Undefined, Value::Bool));
    put("sameSite", o.same_site.clone().map_or(Value::Undefined, Value::from));
    put("path", o.path.clone().map_or(Value::Undefined, Value::from));
    put("domain", o.domain.clone().map_or(Value::Undefined, Value::from));
    Value::object(m)
}

/// `ForgeTestClient`: sends requests to a Forge's routes.
#[derive(Clone)]
pub struct ForgeTestClient {
    forge: Arc<Forge>,
    renderer: Option<Arc<dyn Renderer>>,
}

/// `TestRouteResolver.normalizePath`.
fn normalize_path(path: &str) -> String {
    let with_slash = if path.starts_with('/') { path.to_string() } else { format!("/{path}") };
    if with_slash.len() > 1 && with_slash.ends_with('/') { with_slash[..with_slash.len() - 1].to_string() } else { with_slash }
}

/// `extractPathname`.
pub fn extract_pathname(path: &str) -> &str {
    path.split(['?', '#']).next().unwrap_or(path)
}

/// `TestRouteResolver.resolve`: the first route whose template matches, with its params.
pub fn resolve_route<'a>(routes: &'a [ForgeRoute], path: &str) -> Option<(&'a ForgeRoute, Map)> {
    let pathname = normalize_path(extract_pathname(path));
    let segs = |p: &str| normalize_path(p).split('/').filter(|s| !s.is_empty()).map(str::to_string).collect::<Vec<_>>();
    let actual = segs(&pathname);
    for route in routes {
        let pattern = segs(&route.template_path);
        if pattern.len() != actual.len() {
            continue;
        }
        let mut params = Map::new();
        let matched = pattern.iter().zip(actual.iter()).all(|(p, a)| match p.strip_prefix(':') {
            Some(name) => {
                params.insert(name.into(), Value::from(a.as_str()));
                true
            }
            None => p == a,
        });
        if matched {
            return Some((route, params));
        }
    }
    None
}

fn or_empty(v: Value) -> Value {
    if v.is_undefined() { Value::empty_object() } else { v }
}

impl ForgeTestClient {
    pub fn forge(&self) -> &Forge {
        &self.forge
    }

    pub async fn get(&self, path: &str, options: TestRequestOptions) -> ForgeResult<TestResult> {
        self.dispatch(HttpMethod::Get, path, options).await
    }

    pub async fn post(&self, path: &str, options: TestRequestOptions) -> ForgeResult<TestResult> {
        self.dispatch(HttpMethod::Post, path, options).await
    }

    /// `TestSnapshotFactory.create`.
    pub fn snapshot(&self, method: HttpMethod, path: &str, options: &TestRequestOptions) -> ForgeResult<RequestSnapshot> {
        let method_name = if method == HttpMethod::Post { "POST" } else { "GET" };
        let routes = self.forge.topology();
        let (route, resolved) =
            resolve_route(&routes, path).ok_or_else(|| ForgeError::evaluation(format!("No route matched {method_name} {path}")))?;
        let mut params = match &options.params {
            Value::Object(o) => (**o).clone(),
            _ => Map::new(),
        };
        for (k, v) in resolved {
            params.insert(k, v);
        }
        let params = Value::object(params);
        let headers = match &options.headers {
            Value::Object(o) => Value::object(o.iter().map(|(k, v)| (k.to_lowercase().into(), v.clone())).collect()),
            _ => Value::empty_object(),
        };
        let origin = "http://localhost".to_string();
        Ok(RequestSnapshot {
            node_id: route.node_id.as_str().into(),
            method,
            location: RequestLocation {
                href: format!("{origin}{path}"),
                pathname: extract_pathname(path).to_string(),
                base_path: resolve_path_params(&route.base_path, &params),
                origin,
            },
            params,
            query: or_empty(options.query.clone()),
            post: or_empty(options.body.clone()),
            headers,
            cookies: or_empty(options.cookies.clone()),
            state: or_empty(options.state.clone()),
            session: options.session.clone(),
        })
    }

    async fn dispatch(&self, method: HttpMethod, path: &str, options: TestRequestOptions) -> ForgeResult<TestResult> {
        let snapshot = self.snapshot(method, path, &options)?;
        let response = Arc::new(RecordingResponse::default());
        let result = match &self.renderer {
            Some(r) => self.forge.execute_with_renderer(&snapshot, response.clone(), r.clone()).await,
            None => self.forge.execute(&snapshot, response.clone()).await,
        };
        // TS tests observe the caller's session object; with none passed there is nothing to
        // observe, so the result's session stays undefined.
        let keep_session = !options.session.is_undefined();
        let headers: Map = response.headers.lock().unwrap().iter().map(|(k, v)| (k.as_str().into(), Value::from(v.as_str()))).collect();
        let cookies: Vec<(String, CookieMutation)> = response.cookies.lock().unwrap().iter().map(|(k, c)| (k.clone(), c.clone())).collect();
        Ok(match result {
            Ok(mut outcome) => {
                if !keep_session {
                    outcome.session = Value::Undefined;
                }
                match outcome.kind {
                OutcomeKind::Navigate { url } => TestResult::Redirect { url, headers, cookies, session: outcome.session },
                OutcomeKind::Error(e) => {
                    TestResult::Error { status: Some(e.status), message: e.message, headers, cookies, session: outcome.session }
                }
                OutcomeKind::Render { context, output } => TestResult::Render { context, output, headers, cookies, session: outcome.session },
                }
            }
            // Engine errors surface as error outcomes, as the TS pipeline reports them.
            Err(e) => TestResult::Error { status: e.status(), message: e.to_string(), headers, cookies, session: options.session },
        })
    }
}

/// `expectRenderOutcome`: the render context, or a panic describing what happened instead.
/// An [`EffectContext`] outside any request, for unit-testing an effect's closure: seed answers,
/// data, session and request values, run the effect with [`FunctionEntry::run_effect`], then read
/// back what it wrote.
///
/// ```
/// # async fn demo() -> forge_core::ForgeResult<()> {
/// use forge_core::testing::TestEffectContext;
/// use forge_core::{FunctionEntry, Value, obj};
///
/// let clear = FunctionEntry::effect("Clear", |context, _args| async move {
///     context.clear_answer("name");
///     Ok(())
/// });
/// let context = TestEffectContext::new().with_answers(obj! { "name": "Ada" });
/// clear.run_effect(context.context(), vec![]).await?;
/// assert!(context.answers().get("name").is_none());
/// # Ok(()) }
/// ```
#[derive(Clone, Default)]
pub struct TestEffectContext {
    shared: SharedContext,
    response: Arc<RecordingResponse>,
    hook_type: Option<HookType>,
}

impl TestEffectContext {
    pub fn new() -> Self {
        Self::default()
    }

    /// Seeds answers (each key's current value).
    pub fn with_answers(self, answers: Value) -> Self {
        if let Some(map) = answers.as_object() {
            let mut ctx = self.shared.lock();
            for (k, v) in map.iter() {
                ctx.domain.answers.entry(k.clone()).or_default().push(v.clone(), "load");
            }
        }
        self
    }

    /// Seeds `data()` values.
    pub fn with_data(self, data: Value) -> Self {
        if let Some(map) = data.as_object() {
            let mut ctx = self.shared.lock();
            for (k, v) in map.iter() {
                ctx.domain.data.insert(k.clone(), v.clone());
            }
        }
        self
    }

    pub fn with_session(self, session: Value) -> Self {
        self.shared.lock().request.session = session;
        self
    }

    pub fn with_params(self, params: Value) -> Self {
        self.shared.lock().request.params = params;
        self
    }

    pub fn with_query(self, query: Value) -> Self {
        self.shared.lock().request.query = query;
        self
    }

    pub fn with_post(self, post: Value) -> Self {
        self.shared.lock().request.post = post;
        self
    }

    /// Runs as a submit hook would (answers set by the effect record `"submit"` as their source).
    pub fn submitting(self) -> Self {
        Self { hook_type: Some(HookType::Submit), ..self }
    }

    /// The context to pass to the effect. Every context shares the same state.
    pub fn context(&self) -> EffectContext {
        EffectContext::new(self.shared.clone(), self.response.clone(), self.hook_type.unwrap_or(HookType::Access))
    }

    /// Current answers after the effect ran.
    pub fn answers(&self) -> Map {
        self.context().get_all_answers()
    }

    /// `data()` values after the effect ran.
    pub fn data(&self) -> Map {
        self.context().get_all_data()
    }

    pub fn session(&self) -> Value {
        self.context().get_session()
    }

    /// Response headers the effect set.
    pub fn response_headers(&self) -> indexmap::IndexMap<String, String> {
        self.response.headers.lock().unwrap().clone()
    }
}

pub fn expect_render(result: &TestResult) -> &Value {
    match result {
        TestResult::Render { context, .. } => context,
        other => panic!("expected a render outcome, got {}", describe(other)),
    }
}

/// `expectRedirectOutcome`.
pub fn expect_redirect(result: &TestResult) -> &str {
    match result {
        TestResult::Redirect { url, .. } => url,
        other => panic!("expected a redirect outcome, got {}", describe(other)),
    }
}

/// `expectErrorOutcome`: `(status, message)`.
pub fn expect_error(result: &TestResult) -> (Option<u16>, &str) {
    match result {
        TestResult::Error { status, message, .. } => (*status, message),
        other => panic!("expected an error outcome, got {}", describe(other)),
    }
}

fn describe(result: &TestResult) -> String {
    match result {
        TestResult::Render { context, .. } => format!("render of {}", context.get("step").get("path").to_js_string()),
        TestResult::Redirect { url, .. } => format!("redirect to {url}"),
        TestResult::Error { status, message, .. } => format!("error {status:?}: {message}"),
    }
}

/// The workspace's test fixtures (`rust/fixtures`): recorded inputs with the expected outputs the
/// tests compare against. Expected outputs are snapshots of this implementation's behaviour (first
/// recorded from the TypeScript Forge the port started from). When a behaviour change is
/// intended, rerun the tests with `UPDATE_FIXTURES=1` to rewrite the expectations, and review the
/// diff before committing.
pub mod fixtures {
    use std::path::PathBuf;

    /// `rust/fixtures`.
    pub fn dir() -> PathBuf {
        PathBuf::from(concat!(env!("CARGO_MANIFEST_DIR"), "/../fixtures"))
    }

    pub fn path(name: &str) -> PathBuf {
        dir().join(name)
    }

    /// A fixture's text, or `None` when it is missing.
    pub fn read(name: &str) -> Option<String> {
        std::fs::read_to_string(path(name)).ok()
    }

    /// Whether this run rewrites expectations (`UPDATE_FIXTURES` set and not `0`).
    pub fn updating() -> bool {
        std::env::var("UPDATE_FIXTURES").is_ok_and(|v| !v.is_empty() && v != "0")
    }

    pub fn write(name: &str, contents: &str) {
        std::fs::write(path(name), contents).unwrap_or_else(|e| panic!("writing fixture {name}: {e}"));
        eprintln!("updated fixture {name}");
    }

    /// One JSON value per line.
    pub fn write_ndjson(name: &str, rows: &[serde_json::Value]) {
        let mut out = String::new();
        for row in rows {
            out.push_str(&serde_json::to_string(row).expect("fixture row"));
            out.push('\n');
        }
        write(name, &out);
    }

    /// JSON indented by one space (the recorded fixtures' layout).
    pub fn write_json(name: &str, value: &serde_json::Value) {
        use serde::Serialize;
        let mut buf = Vec::new();
        let mut ser = serde_json::Serializer::with_formatter(&mut buf, serde_json::ser::PrettyFormatter::with_indent(b" "));
        value.serialize(&mut ser).expect("fixture json");
        write(name, &String::from_utf8(buf).expect("utf-8"));
    }

    /// Where tests write their reports: `rust/target/fixture-reports`.
    pub fn report_dir() -> PathBuf {
        let dir = PathBuf::from(concat!(env!("CARGO_MANIFEST_DIR"), "/../target/fixture-reports"));
        std::fs::create_dir_all(&dir).expect("report dir");
        dir
    }
}
