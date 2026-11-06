//! The examples app end to end through Topcoat's router, in process.

use forge_examples_app::app::{AppPaths, router};
use topcoat::router::{Body, Router, to_bytes};

fn app() -> Option<Router> {
    Some(router(AppPaths::from_env(), forge_examples_app::journey::journey()))
}

async fn send(router: &Router, req: http::Request<Body>) -> (http::StatusCode, http::HeaderMap, String) {
    let (parts, body) = router.handle(req).await.into_parts();
    let bytes = to_bytes(body, usize::MAX).await.unwrap();
    (parts.status, parts.headers, String::from_utf8_lossy(&bytes).into_owned())
}

fn get(path: &str, cookie: Option<&str>) -> http::Request<Body> {
    let mut b = http::Request::get(path).header("host", "localhost:3000");
    if let Some(c) = cookie {
        b = b.header("cookie", c);
    }
    b.body(String::new().into()).unwrap()
}

fn sid(headers: &http::HeaderMap) -> String {
    headers.get("set-cookie").expect("session cookie").to_str().unwrap().split(';').next().unwrap().to_string()
}

#[tokio::test]
async fn guide_pages_render() {
    let Some(router) = app() else { return };

    let (status, headers, _) = send(&router, get("/", None)).await;
    assert_eq!(status, 302);
    assert_eq!(headers.get("location").unwrap(), "/forge-developer-guide/get-started");

    let (status, headers, _) = send(&router, get("/forge-developer-guide", None)).await;
    assert_eq!(status, 302, "access hook redirects the journey root");
    assert!(headers.get("location").unwrap().to_str().unwrap().ends_with("get-started/overview"));

    let (status, _, html) = send(&router, get("/forge-developer-guide/get-started/overview", None)).await;
    assert_eq!(status, 200, "{html:.2000}");
    assert!(html.contains("<title>Get started - Forge Developer Guide</title>") || html.contains("Forge Developer Guide"), "{html:.1500}");
    assert!(html.contains("class=\"govuk-heading-xl\""), "markdown rendered");
    assert!(html.contains("guide-side-nav"), "guide layout rendered");

    let (status, _, html) = send(&router, get("/forge-developer-guide/packages/govuk-components/text-input", None)).await;
    assert_eq!(status, 200, "{html:.2000}");
    assert!(html.contains("govuk-input"), "live examples rendered");

    let (status, _, html) = send(&router, get("/forge-developer-guide/search?q=validation", None)).await;
    assert_eq!(status, 200, "{html:.2000}");
    assert!(html.contains("<mark>"), "search results highlight terms: {html:.3000}");

    let (status, _, _) = send(&router, get("/no/such/page", None)).await;
    assert_eq!(status, 404);
}

#[tokio::test]
async fn assets_are_served() {
    let Some(router) = app() else { return };
    let (status, _, js) = send(&router, get("/assets/js/index.js", None)).await;
    assert_eq!(status, 200);
    assert!(js.contains("/assets/govuk/govuk-frontend.min.js") && !js.contains("scss"));
    let (status, _, _) = send(&router, get("/assets/govuk/govuk-frontend.min.js", None)).await;
    assert_eq!(status, 200);
    let (status, _, _) = send(&router, get("/assets/images/crest.svg", None)).await;
    assert_eq!(status, 200);
    let (status, _, _) = send(&router, get("/assets/../Cargo.toml", None)).await;
    assert_eq!(status, 404);
}

#[tokio::test]
async fn posts_need_the_csrf_token() {
    let Some(router) = app() else { return };
    let page = "/forge-developer-guide/packages/govuk-components/text-input";
    let (_, headers, html) = send(&router, get(page, None)).await;
    let cookie = sid(&headers);
    let token = html.split("name=\"_csrf\" value=\"").nth(1).expect("csrf field").split('"').next().unwrap().to_string();

    let post = |body: String| {
        http::Request::post(page)
            .header("host", "localhost:3000")
            .header("content-type", "application/x-www-form-urlencoded")
            .header("cookie", cookie.as_str())
            .body(Body::from(body))
            .unwrap()
    };
    let (status, _, _) = send(&router, post("action=example-basic&exampleBasic=".into())).await;
    assert_eq!(status, 403);
    let (status, _, html) = send(&router, post(format!("_csrf={token}&action=example-basic&exampleBasic="))).await;
    assert_eq!(status, 200);
    assert!(html.contains("Enter your full name"), "validation message shown");
}

fn post(path: &str, cookie: &str, body: String) -> http::Request<Body> {
    http::Request::post(path)
        .header("host", "localhost:3000")
        .header("content-type", "application/x-www-form-urlencoded")
        .header("cookie", cookie)
        .body(Body::from(body))
        .unwrap()
}

fn csrf_token(html: &str) -> String {
    html.split("name=\"_csrf\" value=\"").nth(1).expect("csrf field").split('"').next().unwrap().to_string()
}

/// A pattern demo end to end: an empty submission re-renders with the error, a valid one
/// redirects to the next step, and the session carries the answer back to the first step.
#[tokio::test]
async fn pattern_form_flow() {
    let Some(router) = app() else { return };
    let base = "/forge-developer-guide/patterns/demos/single-question-per-page";
    let first = format!("{base}/your-name");
    let (status, headers, html) = send(&router, get(&first, None)).await;
    assert_eq!(status, 200);
    let cookie = sid(&headers);
    let token = csrf_token(&html);

    let (status, _, html) = send(&router, post(&first, &cookie, format!("_csrf={token}&action=&fullName="))).await;
    assert_eq!(status, 200, "invalid submission re-renders");
    assert!(html.contains("govuk-error-summary"), "error summary shown");

    let (status, headers, _) =
        send(&router, post(&first, &cookie, format!("_csrf={token}&action=&fullName=Ada+Lovelace"))).await;
    assert_eq!(status, 302, "valid submission redirects");
    let location = headers.get("location").expect("location").to_str().unwrap().to_string();
    assert!(location.ends_with("/your-role"), "next step: {location}");

    let (status, _, _) = send(&router, get(&location, Some(&cookie))).await;
    assert_eq!(status, 200);
    let (_, _, html) = send(&router, get(&first, Some(&cookie))).await;
    assert!(html.contains("value=\"Ada Lovelace\""), "answer kept in the session");
}

/// `/llms.txt`, `/llms-full.txt`, a page listed in the index, and a miss.
#[tokio::test]
async fn llms_text_is_served() {
    let Some(router) = app() else { return };
    let (status, headers, index) = send(&router, get("/llms.txt", None)).await;
    assert_eq!(status, 200);
    assert!(headers["content-type"].to_str().unwrap().starts_with("text/plain"));
    assert!(index.starts_with("# Forge Developer Guide"));
    let page = index.split("/llms/forge-developer-guide/").nth(1).expect("a page link").split([')', ' ', '\n']).next().unwrap();
    let (status, headers, body) = send(&router, get(&format!("/llms/forge-developer-guide/{page}"), None)).await;
    assert_eq!(status, 200, "{page}");
    assert!(headers["content-type"].to_str().unwrap().starts_with("text/markdown"));
    assert!(!body.is_empty());
    let (status, _, full) = send(&router, get("/llms-full.txt", None)).await;
    assert_eq!(status, 200);
    assert!(full.len() > index.len());
    let (status, _, _) = send(&router, get("/llms/forge-developer-guide/no-such-page", None)).await;
    assert_eq!(status, 404);
}
