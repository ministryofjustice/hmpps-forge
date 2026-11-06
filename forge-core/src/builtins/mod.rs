//! Built-in functions and components (port of `built-ins`).

pub mod components;
pub mod conditions;
pub mod generators;
pub mod transformers;

use crate::engine::registries::FunctionEntry;
use crate::value::Value;

/// Every built-in function.
pub fn functions() -> Vec<FunctionEntry> {
    let mut all = conditions::all();
    all.extend(transformers::all());
    all.extend(generators::all());
    all
}

/// JS `String.prototype.trim` whitespace set (`\s` plus line terminators and BOM).
pub(crate) fn js_trim(s: &str) -> &str {
    s.trim_matches(is_js_whitespace)
}

pub(crate) fn is_js_whitespace(c: char) -> bool {
    matches!(c, '\u{0009}'..='\u{000D}' | '\u{0020}' | '\u{00A0}' | '\u{1680}' | '\u{2000}'..='\u{200A}' | '\u{2028}' | '\u{2029}' | '\u{202F}' | '\u{205F}' | '\u{3000}' | '\u{FEFF}')
}

/// Compiles a JS regular expression source with JS flags (`i`, `m`, `s`; `g`/`y`/`u` have no
/// effect on a single `test`).
pub(crate) fn js_regex(pattern: &str, flags: &str) -> Result<fancy_regex::Regex, fancy_regex::Error> {
    let mut prefix = String::new();
    for (flag, inline) in [('i', 'i'), ('m', 'm'), ('s', 's')] {
        if flags.contains(flag) {
            prefix.push(inline);
        }
    }
    let source = if prefix.is_empty() { pattern.to_string() } else { format!("(?{prefix}){pattern}") };
    fancy_regex::Regex::new(&source)
}

pub(crate) fn arg(args: &[Value], i: usize) -> Value {
    args.get(i).cloned().unwrap_or_default()
}
