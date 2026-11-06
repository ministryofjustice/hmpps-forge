//! GETs every route in the guide's topology and requires no server errors.

use forge_examples_app::app::{AppPaths, build_forge, guide_deps, router};
use topcoat::router::{Body, to_bytes};

#[tokio::test]
async fn every_guide_route_renders() {
    let journey = forge_examples_app::journey::journey();
    let paths = AppPaths::from_env();
    let routes = build_forge(journey.clone(), guide_deps(&paths)).topology();
    let router = router(paths, journey);
    let (mut ok, mut failures) = (0, Vec::new());
    for route in &routes {
        let path: String = route
            .template_path
            .split('/')
            .map(|s| if s.starts_with(':') { "0" } else { s })
            .collect::<Vec<_>>()
            .join("/");
        let req = http::Request::get(&path).header("host", "localhost:3000").body(Body::from(String::new())).unwrap();
        let (parts, body) = router.handle(req).await.into_parts();
        let html = String::from_utf8_lossy(&to_bytes(body, usize::MAX).await.unwrap()).into_owned();
        if parts.status.is_server_error() {
            let message = html.split("<h1>").nth(1).and_then(|s| s.split("</h1>").next()).unwrap_or("").to_string();
            failures.push(format!("{} {path}: {message}", parts.status));
        } else {
            ok += 1;
        }
    }
    eprintln!("crawl: {} routes, {ok} ok, {} server errors", routes.len(), failures.len());
    for f in &failures {
        eprintln!("  {f}");
    }
    assert!(failures.is_empty());
}
