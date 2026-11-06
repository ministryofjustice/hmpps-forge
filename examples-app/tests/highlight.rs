//! The highlight.js port against highlight.js itself on repository sources
//! (`fixtures/highlight.ndjson`, from `rust/highlight-port/samples.cjs`): each source in
//! its own language and in every other registered grammar, with `ignoreIllegals` on and off.

use forge_examples_app::highlight::highlight_value;
use serde_json::Value;

#[test]
fn highlight_matches_highlight_js() {
    let path = concat!(env!("CARGO_MANIFEST_DIR"), "/../fixtures/highlight.ndjson");
    let Ok(text) = std::fs::read_to_string(path) else {
        eprintln!("highlight corpus not recorded; skipping");
        return;
    };
    let (mut total, mut failures) = (0, Vec::new());
    for line in text.lines().filter(|l| !l.is_empty()) {
        let row: Value = serde_json::from_str(line).unwrap();
        let (code, language) = (row["code"].as_str().unwrap(), row["language"].as_str().unwrap());
        let ignore = row["ignoreIllegals"].as_bool().unwrap();
        let expected = row["value"].as_str().unwrap();
        total += 1;
        let got = highlight_value(code, language, ignore).expect("registered language");
        if got != expected {
            let at = got.chars().zip(expected.chars()).take_while(|(a, b)| a == b).count();
            let ctx = |s: &str| s.chars().skip(at.saturating_sub(120)).take(240).collect::<String>();
            failures.push(format!("{} as {language} (ignoreIllegals {ignore})\n  rust: {:?}\n  hljs: {:?}", row["file"], ctx(&got), ctx(expected)));
        }
    }
    eprintln!("highlight: {}/{total} identical", total - failures.len());
    for f in failures.iter().take(5) {
        eprintln!("--- {f}");
    }
    assert!(failures.is_empty());
}
