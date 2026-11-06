//! JavaScript-style `r/pattern/flags` regex literals — subset of ECMAScript semantics via the `regex` crate.

use crate::errors::{Result, RunjucksError};
use regex::RegexBuilder;

/// Unescape a Nunjucks/JS regex **pattern body** (between `/` delimiters) for use with Rust `regex`.
pub fn unescape_js_regex_pattern(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\\' {
            match chars.next() {
                Some('/') => out.push('/'),
                Some('\\') => out.push('\\'),
                Some('n') => out.push('\n'),
                Some('r') => out.push('\r'),
                Some('t') => out.push('\t'),
                Some(x) => {
                    out.push('\\');
                    out.push(x);
                }
                None => out.push('\\'),
            }
        } else {
            out.push(c);
        }
    }
    out
}

/// Build a Rust [`regex::Regex`] from JS-style pattern and flags (`g`, `i`, `m`, `y` — `y` is ignored; `g` does not change `is_match`).
pub fn compile_js_regex(pattern: &str, flags: &str) -> Result<regex::Regex> {
    let p = unescape_js_regex_pattern(pattern);
    let mut b = RegexBuilder::new(&p);
    if flags.contains('i') {
        b.case_insensitive(true);
    }
    if flags.contains('m') {
        b.multi_line(true);
    }
    // `g` — global state in JS; `.test()` / `is_match` use whole-string search here.
    // `y` — sticky; not modeled.
    b.build()
        .map_err(|e| RunjucksError::new(format!("invalid regex: {e}")))
}

/// Nunjucks/JS `RegExp.prototype.test(string)` — whether the regex matches a substring of `haystack`.
pub fn regexp_test(pattern: &str, flags: &str, haystack: &str) -> Result<bool> {
    let re = compile_js_regex(pattern, flags)?;
    Ok(re.is_match(haystack))
}
