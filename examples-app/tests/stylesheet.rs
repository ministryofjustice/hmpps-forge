//! The app stylesheet compiled by grass against dart-sass's output for the same entry
//! (`fixtures/stylesheet.css`, written by the `sass` CLI with the TS build's options).
//!
//! Outputs are compared rule by rule (every style rule and at-rule, in order) after normalising
//! spellings that mean the same CSS: hex colour length, `rgb()` percentages, whitespace after
//! `@media`/`@supports` and inside parentheses and lists, leading zeros, `-0`, letter case.

use forge_examples_app::app::{compile_scss, AppPaths};
use regex::Regex;

fn normalise(css: &str) -> String {
    let mut css = css.to_lowercase();
    let hex = Regex::new(r"#([0-9a-f]{3,8})\b").unwrap();
    css = hex
        .replace_all(&css, |c: &regex::Captures| {
            let h = &c[1];
            if h.len() == 3 || h.len() == 4 { format!("#{}", h.chars().flat_map(|ch| [ch, ch]).collect::<String>()) } else { format!("#{h}") }
        })
        .into_owned();
    // `rgb(54.62%, 22.50%, 10.98%)` -> the hex colour browsers round it to.
    let pct = Regex::new(r"rgb\(\s*([\d.]+)%\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)").unwrap();
    css = pct
        .replace_all(&css, |c: &regex::Captures| {
            let ch = |i: usize| (c[i].parse::<f64>().unwrap() * 2.55).round() as u8;
            format!("#{:02x}{:02x}{:02x}", ch(1), ch(2), ch(3))
        })
        .into_owned();
    for (pattern, with) in [
        (r"@(media|supports)\s*\(", "@$1("),
        (r"\)\s*and\s*\(", ") and ("),
        (r"(^|[^0-9a-z.])(-?)0\.(\d)", "$1$2.$3"),
        (r"(^|[^0-9a-z.])-0(%|px|em|rem)?([^0-9.])", "${1}0$2$3"),
        (r"\(\s+", "("),
        (r"\s+\)", ")"),
        (r",\s+", ","),
    ] {
        css = Regex::new(pattern).unwrap().replace_all(&css, with).into_owned();
    }
    css
}

/// Top-level statements (`selector{...}`, `@media ...{...}`, `@charset ...;`), quotes respected.
fn statements(css: &str) -> Vec<String> {
    let (mut out, mut current, mut depth, mut quote) = (Vec::new(), String::new(), 0usize, None::<char>);
    for c in css.chars() {
        current.push(c);
        match (quote, c) {
            (Some(q), _) if c == q => quote = None,
            (Some(_), _) => {}
            (None, '"' | '\'') => quote = Some(c),
            (None, '{') => depth += 1,
            (None, '}') => {
                depth -= 1;
                if depth == 0 {
                    out.push(std::mem::take(&mut current).trim().to_string());
                }
            }
            (None, ';') if depth == 0 => out.push(std::mem::take(&mut current).trim().to_string()),
            _ => {}
        }
    }
    if !current.trim().is_empty() {
        out.push(current.trim().to_string());
    }
    out
}

#[test]
fn stylesheet_matches_dart_sass() {
    let path = concat!(env!("CARGO_MANIFEST_DIR"), "/../fixtures/stylesheet.css");
    let Ok(dart) = std::fs::read_to_string(path) else {
        eprintln!("dart-sass stylesheet not recorded; skipping");
        return;
    };
    let paths = AppPaths::from_env();
    if !paths.node_modules().join("govuk-frontend").is_dir() {
        eprintln!("examples-app/node_modules missing (npm ci in rust/examples-app); skipping");
        return;
    }
    let grass = compile_scss(&paths).expect("grass compiles the app stylesheet");
    let (ours, theirs) = (statements(&normalise(&grass)), statements(&normalise(&dart)));
    let differing: Vec<String> = ours
        .iter()
        .zip(theirs.iter())
        .enumerate()
        .filter(|(_, (a, b))| a != b)
        .take(5)
        .map(|(i, (a, b))| format!("rule {i}\n  grass: {}\n  dart : {}", &a[..a.len().min(300)], &b[..b.len().min(300)]))
        .collect();
    eprintln!("stylesheet: grass {} rules, dart-sass {} rules, {} differ", ours.len(), theirs.len(), differing.len());
    assert!(ours.len() == theirs.len() && differing.is_empty(), "{}", differing.join("\n"));
}
