//! The guide's Markdown renderer (`govukMarkdown`) on recorded pages (`fixtures/markdown.ndjson`,
//! first recorded from markdown-it + highlight.js through the TS app): the same Markdown must
//! render the same HTML. The fixture holds its own Markdown, so guide content changes do not
//! affect it. `UPDATE_FIXTURES=1` rewrites the expected HTML.

use forge_core::Value;
use forge_core::testing::fixtures;
use forge_examples_app::markdown::govuk_markdown;

#[test]
fn markdown_renders_as_recorded() {
    let Some(text) = fixtures::read("markdown.ndjson") else {
        eprintln!("markdown fixture missing; skipping");
        return;
    };
    let toc = |name: &str| (name == "toc").then(|| "<!--toc-->".to_string());
    let updating = fixtures::updating();
    let (mut pages, mut failures, mut updated) = (0, Vec::new(), Vec::new());
    for line in text.lines() {
        let mut row: Value = serde_json::from_str(line).unwrap();
        let slug = row.get("slug").to_js_string();
        let got = govuk_markdown(&row.get("markdown").to_js_string(), Some(&toc));
        pages += 1;
        if updating {
            row.set("html", Value::from(got));
            updated.push(row.to_json());
            continue;
        }
        let expected = row.get("html").to_js_string();
        if got != expected {
            let at = got.chars().zip(expected.chars()).take_while(|(a, b)| a == b).count();
            let ctx = |s: &str| s.chars().skip(at.saturating_sub(150)).take(300).collect::<String>();
            failures.push(format!("{slug}\n  got     : {:?}\n  expected: {:?}", ctx(&got), ctx(&expected)));
        }
    }
    if updating {
        fixtures::write_ndjson("markdown.ndjson", &updated);
        return;
    }
    eprintln!("markdown: {pages} pages, {} differ", failures.len());
    for f in failures.iter().take(3) {
        eprintln!("--- {f}");
    }
    assert!(failures.is_empty());
}
