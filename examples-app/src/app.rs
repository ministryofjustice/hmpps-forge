//! `createApp` (server/app.ts): the Forge instance, the Runjucks page environment, static
//! assets, health checks and error pages, mounted on a Topcoat router.

use std::path::PathBuf;
use std::sync::{Arc, OnceLock};

use forge_core::engine::forge::{ForgeOptions, ForgePackage};
use forge_core::{Forge, Value};
use forge_runjucks::{RunjucksEngine, RunjucksRenderer};
use forge_topcoat::{AdapterOptions, mount};
use serde_json::Value as Json;
use topcoat::context::Cx;
use forge_devtools::{set_up_forge_devtools, ForgeDevToolsOptions};
use topcoat::router::response::Response;
use topcoat::router::{Body, Method, Methods, Path, Route, RouteFuture, RouteId, Router, RouterBuilder, StatusCode, request};

use crate::data::{ContentEntry, FormDataStore, GuideContentStore, MocksApi};
use crate::llms::LlmsTextGenerator;
use crate::effects::{GuideDeps, guide_effects, pattern_effects, pattern_transformers};
use crate::search::GuideSearch;

pub const APPLICATION_NAME: &str = "Forge Developer Guide";

/// Where the app finds the files it reads at runtime.
#[derive(Clone)]
pub struct AppPaths {
    /// The app's files: `views/`, `content/` (guide Markdown and pattern sources), `assets/` and
    /// `node_modules/` (GOV.UK Frontend, MOJ Frontend, highlight.js).
    pub root: PathBuf,
    /// Forge's MOJ components (`templates/`, `styles/`).
    pub moj_components: PathBuf,
}

impl AppPaths {
    /// `FORGE_APP_ROOT` (default: this crate's directory) and `FORGE_MOJ_COMPONENTS` (default: the
    /// `forge-moj-components` crate's directory).
    pub fn from_env() -> Self {
        let var = |name: &str| std::env::var_os(name).filter(|v| !v.is_empty()).map(PathBuf::from);
        Self {
            root: var("FORGE_APP_ROOT").unwrap_or_else(|| PathBuf::from(env!("CARGO_MANIFEST_DIR"))),
            moj_components: var("FORGE_MOJ_COMPONENTS").unwrap_or_else(forge_moj_components::crate_dir),
        }
    }

    pub fn views(&self) -> PathBuf {
        self.root.join("views")
    }

    pub fn content_dir(&self) -> PathBuf {
        self.root.join("content")
    }

    /// The pattern demos' sources, shown in the code panels.
    pub fn patterns_dir(&self) -> PathBuf {
        self.content_dir().join("sections/patterns")
    }

    pub fn assets(&self) -> PathBuf {
        self.root.join("assets")
    }

    pub fn node_modules(&self) -> PathBuf {
        self.root.join("node_modules")
    }

    fn moj_templates(&self) -> PathBuf {
        self.moj_components.join("templates")
    }

    fn moj_styles(&self) -> PathBuf {
        self.moj_components.join("styles")
    }
}

fn initialise_name(value: &Json, _: &[Json]) -> Result<Json, runjucks_core::errors::RunjucksError> {
    let Some(full) = value.as_str().filter(|s| !s.is_empty()) else { return Ok(Json::Null) };
    let parts: Vec<&str> = full.split(' ').collect();
    let first = parts[0].chars().next().map(String::from).unwrap_or_else(|| "undefined".into());
    Ok(Json::String(format!("{first}. {}", parts[parts.len() - 1])))
}

/// `groupByMetadata(items, key)`: consecutive-insensitive grouping by `item.metadata[key]`,
/// in first-seen order.
fn group_by_metadata(value: &Json, args: &[Json]) -> Result<Json, runjucks_core::errors::RunjucksError> {
    let key = args.first().and_then(Json::as_str).unwrap_or_default();
    let mut groups: Vec<(Json, Vec<Json>)> = Vec::new();
    for item in value.as_array().into_iter().flatten() {
        let name = item.get("metadata").and_then(|m| m.get(key)).cloned().unwrap_or(Json::Null);
        match groups.iter_mut().find(|(n, _)| *n == name) {
            Some((_, items)) => items.push(item.clone()),
            None => groups.push((name, vec![item.clone()])),
        }
    }
    Ok(Json::Array(
        groups.into_iter().map(|(name, items)| serde_json::json!({ "name": name, "items": items })).collect(),
    ))
}

/// The page environment (`nunjucksSetup`): app views first, then GOV.UK, MOJ and Forge's MOJ
/// component templates.
pub fn page_engine(paths: &AppPaths) -> RunjucksEngine {
    let nm = paths.node_modules();
    let mut engine = RunjucksEngine::new([
        paths.views(),
        nm.join("govuk-frontend/dist"),
        nm.join("@ministryofjustice/frontend"),
        paths.moj_templates(),
    ]);
    let env = engine.environment_mut();
    env.add_filter("initialiseName", Arc::new(initialise_name));
    env.add_filter("assetMap", Arc::new(|v: &Json, _: &[Json]| Ok(v.clone())));
    env.add_filter("groupByMetadata", Arc::new(group_by_metadata));
    engine
}

/// The app's Forge: GOV.UK, MOJ and Nunjucks globals plus the developer guide package.
pub fn build_forge(journey: Value, deps: Arc<GuideDeps>) -> Forge {
    let mut forge = Forge::new(ForgeOptions::default());
    forge.register_global_components(forge_govuk_components::components()).expect("GOV.UK components");
    forge.register_global_components(forge_moj_components::components()).expect("MOJ components");
    forge.register_global_functions(forge_runjucks::nunjucks_functions()).expect("Nunjucks functions");
    let mut functions = guide_effects(&deps);
    functions.extend(pattern_effects(&deps));
    functions.extend(pattern_transformers());
    forge
        .register_package(
            ForgePackage::new(journey).with_functions(functions).with_components(crate::components::components()),
        )
        .expect("developer guide package");
    forge
}

pub fn guide_deps(paths: &AppPaths) -> Arc<GuideDeps> {
    let content = GuideContentStore::load(paths.content_dir()).expect("guide content");
    let search = GuideSearch::new(&content);
    Arc::new(GuideDeps { content, search, forms: FormDataStore::from_env(), mocks: MocksApi })
}

fn header(name: &'static str, value: &'static str) -> (http::HeaderName, http::HeaderValue) {
    (http::HeaderName::from_static(name), http::HeaderValue::from_static(value))
}

/// The whole app as a router.
pub fn router(paths: AppPaths, journey: Value) -> Router {
    let deps = guide_deps(&paths);
    // `server/forgeDevTools.ts`: the devtools bridge is an instrumentation sink plus a websocket
    // route; auth codes are only required in production.
    let devtools = set_up_forge_devtools(ForgeDevToolsOptions {
        no_auth: std::env::var("NODE_ENV").as_deref() != Ok("production"),
        redis_url: redis_url_from_env(),
        ..ForgeDevToolsOptions::default()
    });
    let mut forge = build_forge(journey, deps.clone());
    forge.add_instrumentation_sink(Arc::new(devtools.clone()));
    let forge = Arc::new(forge);
    let engine = Arc::new(page_engine(&paths));
    let renderer = Arc::new(RunjucksRenderer::new(page_engine(&paths)));
    let error_engine = engine.clone();
    let state = Value::from_pairs([
        ("asset_path", Value::from("/assets/")),
        ("applicationName", Value::from(APPLICATION_NAME)),
        ("environmentName", Value::from(std::env::var("ENVIRONMENT_NAME").unwrap_or_default())),
    ]);
    let options = AdapterOptions {
        state,
        csrf: std::env::var("NODE_ENV").as_deref() != Ok("test"),
        headers: vec![
            header("link", "</llms.txt>; rel=\"llms-txt\", </llms-full.txt>; rel=\"llms-full-txt\""),
            header("x-content-type-options", "nosniff"),
            header("x-frame-options", "SAMEORIGIN"),
            header("referrer-policy", "no-referrer"),
            header("cross-origin-embedder-policy", "require-corp"),
            header(
                "content-security-policy",
                "default-src 'self';script-src 'self' 'nonce-{nonce}';style-src 'self' 'nonce-{nonce}';font-src 'self';\
                 form-action 'self';base-uri 'self';frame-ancestors 'self';img-src 'self' data:;object-src 'none';\
                 script-src-attr 'none';upgrade-insecure-requests",
            ),
        ],
        csp_nonce: true,
        error_page: Some(Arc::new(move |status, message, state| error_page(&error_engine, status, message, state))),
        ..AdapterOptions::default()
    };
    let builder = devtools.mount(mount(Router::builder(), forge, renderer, options));
    let assets = Arc::new(Assets { paths: paths.clone(), css: OnceLock::new() });
    // Compile the stylesheet in the background at startup; a request that arrives first waits.
    let warm = assets.clone();
    std::thread::spawn(move || {
        warm.css.get_or_init(|| stylesheet(&warm.paths));
    });
    let builder = llms_routes(builder, deps);
    add_routes(builder, assets, engine.clone()).build()
}

/// `config.redis` + `createRedisClient`: the app's Redis as a URL, when `REDIS_ENABLED=true`.
pub fn redis_url_from_env() -> Option<String> {
    let var = |name: &str| std::env::var(name).ok().filter(|v| !v.is_empty());
    if var("REDIS_ENABLED").as_deref() != Some("true") {
        return None;
    }
    let host = var("REDIS_HOST").unwrap_or_else(|| "localhost".into());
    let port = var("REDIS_PORT").and_then(|p| p.parse::<u16>().ok()).unwrap_or(6379);
    let scheme = if var("REDIS_TLS_ENABLED").as_deref() == Some("true") { "rediss" } else { "redis" };
    let auth = var("REDIS_AUTH_TOKEN").map(|t| format!(":{}@", percent_encode_userinfo(&t))).unwrap_or_default();
    Some(format!("{scheme}://{auth}{host}:{port}"))
}

fn percent_encode_userinfo(s: &str) -> String {
    s.bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' => (b as char).to_string(),
            _ => format!("%{b:02X}"),
        })
        .collect()
}

fn error_page(engine: &RunjucksEngine, status: u16, message: &str, state: &Value) -> String {
    if status >= 500 {
        eprintln!("error {status}: {message}");
    }
    let mut context = state.clone();
    context.set("message", Value::from(message));
    context.set("status", Value::Number(status as f64));
    engine.render("pages/error.njk", &context).unwrap_or_else(|_| format!("{status} {message}"))
}

type Handler = Arc<dyn Fn(&Cx) -> Response + Send + Sync>;

/// A plain (non-Forge) GET route.
struct FnRoute {
    id: RouteId,
    path: &'static Path,
    handler: Handler,
}

impl Route for FnRoute {
    fn id(&self) -> RouteId {
        self.id
    }

    fn methods(&self) -> Methods<'_> {
        Methods::Only(&[Method::GET])
    }

    fn path(&self) -> &Path {
        self.path
    }

    fn handle<'cx>(&'cx self, cx: &'cx Cx, _body: Body) -> RouteFuture<'cx> {
        let response = (self.handler)(cx);
        Box::pin(async move { Ok(response) })
    }
}

fn get(builder: RouterBuilder, path: &'static str, handler: impl Fn(&Cx) -> Response + Send + Sync + 'static) -> RouterBuilder {
    builder.route(FnRoute { id: RouteId::new(), path: Path::new(path), handler: Arc::new(handler) })
}

fn respond(status: StatusCode, content_type: &str, body: impl Into<Body>) -> Response {
    let mut r = Response::new(body.into());
    *r.status_mut() = status;
    if let Ok(v) = http::HeaderValue::from_str(content_type) {
        r.headers_mut().insert(http::header::CONTENT_TYPE, v);
    }
    r
}

/// `llmsTxtRouter`: `/llms.txt`, `/llms-full.txt` and `/llms/forge-developer-guide/<page>`.
fn llms_routes(builder: RouterBuilder, deps: Arc<GuideDeps>) -> RouterBuilder {
    let ingress = std::env::var("INGRESS_URL").unwrap_or_else(|_| "http://localhost:3000".into());
    let generator = Arc::new(LlmsTextGenerator::new(ingress, crate::guide::support::pattern_demo_sources));
    let entries: Arc<Vec<ContentEntry>> = Arc::new(deps.content.all().cloned().collect());
    const PLAIN: &str = "text/plain; charset=utf-8";
    let (g, e) = (generator.clone(), entries.clone());
    let builder = get(builder, "/llms.txt", move |_| respond(StatusCode::OK, PLAIN, g.build_index(&e)));
    let (g, e) = (generator.clone(), entries.clone());
    let builder = get(builder, "/llms-full.txt", move |_| respond(StatusCode::OK, PLAIN, g.build_full(&e)));
    let page = move |cx: &Cx| {
        let path = request::uri(cx).path().strip_prefix("/llms/forge-developer-guide").unwrap_or_default().to_string();
        match generator.find_entry(&entries, Some(&percent_decode(&path))) {
            Some(entry) => {
                respond(StatusCode::OK, "text/markdown; charset=utf-8", generator.build_content_page(entry, &entries))
            }
            None => respond(StatusCode::NOT_FOUND, PLAIN, "Not found"),
        }
    };
    let page = Arc::new(page);
    let p = page.clone();
    let builder = get(builder, "/llms/forge-developer-guide", move |cx| p(cx));
    get(builder, "/llms/forge-developer-guide/{*path}", move |cx| page(cx))
}

fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%'
            && i + 2 < bytes.len()
            && let Ok(b) = u8::from_str_radix(std::str::from_utf8(&bytes[i + 1..i + 3]).unwrap_or("zz"), 16)
        {
            out.push(b);
            i += 3;
            continue;
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn add_routes(builder: RouterBuilder, assets: Arc<Assets>, engine: Arc<RunjucksEngine>) -> RouterBuilder {
    let builder = get(builder, "/", |_| {
        let mut r = respond(StatusCode::FOUND, "text/plain; charset=utf-8", "Found. Redirecting to /forge-developer-guide/get-started");
        r.headers_mut().insert(http::header::LOCATION, http::HeaderValue::from_static("/forge-developer-guide/get-started"));
        r
    });
    let builder = get(builder, "/ping", |_| respond(StatusCode::OK, "application/json", r#"{"status":"UP"}"#));
    let builder = get(builder, "/health", |_| {
        respond(StatusCode::OK, "application/json", r#"{"status":"UP","components":{}}"#)
    });
    let builder = get(builder, "/info", |_| {
        let body = serde_json::json!({ "build": { "name": "hmpps-forge-example-app", "version": env!("CARGO_PKG_VERSION") } });
        respond(StatusCode::OK, "application/json", body.to_string())
    });
    let builder = get(builder, "/assets/{*path}", move |cx| assets.serve(request::uri(cx).path()));
    get(builder, "/{*path}", move |_| {
        let state = Value::from_pairs([("applicationName", Value::from(APPLICATION_NAME))]);
        respond(StatusCode::NOT_FOUND, "text/html; charset=utf-8", error_page(&engine, 404, "Not found", &state))
    })
}

/// `/assets/*` (`setUpStaticResources` plus the rolldown build): the stylesheet is compiled from
/// the app's SCSS with grass on first request; `js/index.js` is served unbundled, its bare
/// imports pointed at the ES module builds GOV.UK Frontend and MOJ Frontend already ship.
struct Assets {
    paths: AppPaths,
    css: OnceLock<Result<String, String>>,
}

fn content_type(path: &str) -> &'static str {
    match path.rsplit('.').next().unwrap_or_default() {
        "css" => "text/css; charset=utf-8",
        "js" | "mjs" => "text/javascript; charset=utf-8",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "ico" => "image/x-icon",
        "woff2" => "font/woff2",
        "woff" => "font/woff",
        "json" => "application/json",
        "map" => "application/json",
        _ => "application/octet-stream",
    }
}

impl Assets {
    fn static_dirs(&self) -> Vec<PathBuf> {
        let nm = self.paths.node_modules();
        vec![
            self.paths.assets(),
            nm.join("govuk-frontend/dist/govuk/assets"),
            nm.join("govuk-frontend/dist"),
            nm.join("@ministryofjustice/frontend/moj/assets"),
            nm.join("@ministryofjustice/frontend"),
        ]
    }

    fn serve(&self, uri_path: &str) -> Response {
        let rel = uri_path.trim_start_matches("/assets/");
        if rel.split('/').any(|seg| seg == ".." || seg.is_empty()) {
            return respond(StatusCode::NOT_FOUND, "text/plain", "Not found");
        }
        let cached = |mut r: Response| {
            r.headers_mut().insert(http::header::CACHE_CONTROL, http::HeaderValue::from_static("public, max-age=86400"));
            r
        };
        match rel {
            "css/index.css" => {
                return match self.css.get_or_init(|| stylesheet(&self.paths)) {
                    Ok(css) => cached(respond(StatusCode::OK, content_type(rel), css.clone())),
                    Err(e) => respond(StatusCode::INTERNAL_SERVER_ERROR, "text/plain", e.clone()),
                };
            }
            "js/index.js" => {
                let source = std::fs::read_to_string(self.paths.assets().join("js/index.js")).unwrap_or_default();
                return cached(respond(StatusCode::OK, content_type(rel), rewrite_entry(&source)));
            }
            _ => {}
        }
        for dir in self.static_dirs() {
            let file = dir.join(rel);
            if file.is_file()
                && let Ok(bytes) = std::fs::read(&file)
            {
                return cached(respond(StatusCode::OK, content_type(rel), bytes));
            }
        }
        respond(StatusCode::NOT_FOUND, "text/plain", "Not found")
    }
}

/// `index.js` without a bundler: drop the stylesheet import (served separately) and resolve the
/// two package imports to their browser builds.
pub fn rewrite_entry(source: &str) -> String {
    source
        .lines()
        .filter(|l| !l.trim_start().starts_with("import '../scss/"))
        .map(|l| {
            l.replace("from 'govuk-frontend'", "from '/assets/govuk/govuk-frontend.min.js'")
                .replace("from '@ministryofjustice/frontend'", "from '/assets/moj/moj-frontend.min.js'")
        })
        .collect::<Vec<_>>()
        .join("\n")
}

/// The app stylesheet, `assets/scss/index.scss` compiled with grass (the TS build compiles the
/// same entry with dart-sass; `tests/stylesheet.rs` compares the two).
pub fn stylesheet(paths: &AppPaths) -> Result<String, String> {
    compile_scss(paths)
}

pub fn compile_scss(paths: &AppPaths) -> Result<String, String> {
    let options = grass::Options::default()
        .load_path(&paths.root)
        .load_path(paths.node_modules())
        .load_path(paths.moj_styles())
        .quiet(true)
        .style(grass::OutputStyle::Compressed);
    grass::from_path(paths.assets().join("scss/index.scss"), &options).map_err(|e| format!("Sass: {e}"))
}
