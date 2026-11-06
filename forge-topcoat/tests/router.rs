//! Drives a real journey through Topcoat's router in-process: GET renders the step through
//! Runjucks, an invalid POST re-renders with errors, a valid POST redirects, and the session
//! cookie round-trips.

use std::sync::Arc;

use forge_core::authoring::*;
use forge_core::engine::forge::{ForgeOptions, ForgePackage};
use forge_core::{Forge, Value, obj};
use forge_govuk_components::blocks::TEXT_INPUT;
use forge_runjucks::{RunjucksEngine, RunjucksRenderer};
use forge_topcoat::{AdapterOptions, mount};
use topcoat::router::{Router, to_bytes};

fn demo_journey() -> Value {
    journey(obj! {
        "code": "demo",
        "path": "/demo",
        "title": "Demo",
        "steps": [
            step(obj! {
                "path": "/name",
                "title": "Your name",
                "reachability": obj! { "entryWhen": true },
                "blocks": [TEXT_INPUT.build(obj! {
                    "code": "fullName",
                    "label": "Full name",
                    "validWhen": [validation(obj! {
                        "condition": self_().matches(condition::is_required()),
                        "message": "Enter your full name",
                    })],
                })],
                "onSubmission": [submit(obj! {
                    "validate": true,
                    "onValid": obj! { "next": [redirect(obj! { "goto": "done" })] },
                })],
            }),
            step(obj! { "code": "done", "path": "/done", "title": "Done", "blocks": Vec::<Value>::new() }),
        ],
    })
}

fn router() -> Router {
    let mut forge = Forge::new(ForgeOptions::default());
    forge
        .register_package(ForgePackage::new(demo_journey()).with_components(forge_govuk_components::components()))
        .unwrap();
    let node_modules = concat!(env!("CARGO_MANIFEST_DIR"), "/../examples-app/node_modules");
    let engine = RunjucksEngine::new([
        format!("{}/tests/views", env!("CARGO_MANIFEST_DIR")),
        format!("{node_modules}/govuk-frontend/dist"),
    ]);
    mount(Router::builder(), Arc::new(forge), Arc::new(RunjucksRenderer::new(engine)), AdapterOptions::default()).build()
}

async fn send(router: &Router, req: http::Request<topcoat::router::Body>) -> (http::StatusCode, http::HeaderMap, String) {
    let res = router.handle(req).await;
    let (parts, body) = res.into_parts();
    let bytes = to_bytes(body, usize::MAX).await.unwrap();
    (parts.status, parts.headers, String::from_utf8_lossy(&bytes).into_owned())
}

fn post(path: &str, body: &str, cookie: &str) -> http::Request<topcoat::router::Body> {
    http::Request::post(path)
        .header("host", "localhost:3000")
        .header("content-type", "application/x-www-form-urlencoded")
        .header("cookie", cookie)
        .body(body.to_string().into())
        .unwrap()
}

#[tokio::test]
async fn get_post_and_redirect() {
    let router = router();

    let get = http::Request::get("/demo/name").header("host", "localhost:3000").body(String::new().into()).unwrap();
    let (status, headers, html) = send(&router, get).await;
    assert_eq!(status, 200, "{html}");
    assert!(html.contains("<title>Your name</title>"), "{html}");
    assert!(html.contains("govuk-input"), "{html}");
    let cookie = headers.get("set-cookie").expect("session cookie").to_str().unwrap();
    assert!(cookie.starts_with("forge.sid="), "{cookie}");
    let sid = cookie.split(';').next().unwrap().to_string();

    let (status, _, html) = send(&router, post("/demo/name", "fullName=", &sid)).await;
    assert_eq!(status, 200, "{html}");
    assert!(html.contains("Enter your full name"), "{html}");

    let (status, headers, body) = send(&router, post("/demo/name", "fullName=Ada+Lovelace", &sid)).await;
    assert_eq!(status, 302, "{body}");
    let location = headers.get("location").unwrap().to_str().unwrap();
    assert!(location.ends_with("/demo/done"), "{location}");
    assert!(headers.get("set-cookie").is_none(), "existing session should be reused");

    let json = http::Request::post("/demo/name")
        .header("content-type", "application/json")
        .body("{}".to_string().into())
        .unwrap();
    assert_eq!(send(&router, json).await.0, 415);
}

/// `AdapterOptions::with_request_state`: per-request values merged over the fixed `state`, read
/// by expressions (`request::state`).
#[tokio::test]
async fn request_state_reaches_expressions() {
    let journey = journey(obj! {
        "code": "who",
        "path": "/who",
        "title": "Who",
        "steps": [step(obj! {
            "path": "/me",
            "title": "Me",
            "reachability": obj! { "entryWhen": true },
            "blocks": [block(obj! {
                "variant": "html",
                "content": format("%1 / %2", [request::state("user.name").into(), request::state("service").into()]),
            })],
        })],
    });
    let mut forge = Forge::new(ForgeOptions::default());
    forge.register_package(ForgePackage::new(journey)).unwrap();
    let engine = RunjucksEngine::new([format!("{}/tests/views", env!("CARGO_MANIFEST_DIR"))]);
    let options = AdapterOptions { state: obj! { "service": "Demo", "user": "nobody" }, ..AdapterOptions::default() }
        .with_request_state(|info| async move {
            let name = info.headers.get("x-user").and_then(|v| v.to_str().ok()).unwrap_or("anonymous").to_string();
            obj! { "user": obj! { "name": name } }
        });
    let router = mount(Router::builder(), Arc::new(forge), Arc::new(RunjucksRenderer::new(engine)), options).build();

    let get = http::Request::get("/who/me").header("host", "localhost").header("x-user", "Ada").body(String::new().into()).unwrap();
    let (status, _, html) = send(&router, get).await;
    assert_eq!(status, 200, "{html}");
    assert!(html.contains("Ada / Demo"), "{html}");
}
