//! Server-side code highlighting: a port of the highlight.js 11 engine (`engine`) running the
//! grammars highlight.js itself compiled for the languages the guide registers (`grammars.json`,
//! exported by `rust/highlight-port/export.cjs` from the installed highlight.js; regenerate it
//! when highlight.js is upgraded). `tests/markdown.rs` checks every guide code block against
//! highlight.js.

mod engine;
pub mod jsregex;

use std::sync::LazyLock;

use engine::Registry;

static REGISTRY: LazyLock<Registry> = LazyLock::new(|| Registry::load(include_str!("grammars.json")));

pub use engine::escape_html as escape;

/// `hljs.getLanguage(name)`: the registered language a name or alias resolves to.
pub fn language(name: &str) -> Option<String> {
    REGISTRY.language_name(name)
}

/// `hljs.highlight(code, { language, ignoreIllegals }).value`; `None` when the language is not
/// registered.
pub fn highlight_value(code: &str, lang: &str, ignore_illegals: bool) -> Option<String> {
    let name = REGISTRY.language_name(lang)?;
    Some(engine::highlight_with(&REGISTRY, &name, code, ignore_illegals, None).value)
}

/// markdown-it's `highlight` option in `govukMarkdown`: `hljs.highlight(str, { language })`.
pub fn highlight(code: &str, lang: &str) -> Option<String> {
    if lang.is_empty() {
        return None;
    }
    highlight_value(code, lang, false)
}
