//! Hand-ported pieces the journey modules build on: the guide's component builders
//! (`components/*.ts`), `loadContent` (`effects.ts`) and `patternStep` with its source reader
//! and highlighter (`sections/patterns/shared/*`). The code panels show the `.rs` display
//! sources under `content/sections/patterns` (kept compiling by `tests/pattern_sources.rs`).

use std::path::PathBuf;
use std::sync::LazyLock;

use forge_core::Value;
use forge_core::obj;

use crate::guide::dsl::*;

/// `GovUKMarkdownBlock(props)`.
pub fn govuk_markdown_block(props: impl IntoValue) -> D {
    component(&crate::components::GOVUK_MARKDOWN, props)
}

/// `TableOfContents(props)`.
pub fn table_of_contents(props: impl IntoValue) -> D {
    component(&crate::components::TABLE_OF_CONTENTS, props)
}

/// `LotteryBall(props)`.
pub fn lottery_ball(props: impl IntoValue) -> D {
    component(&crate::components::LOTTERY_BALL, props)
}

/// `RichTextEditor(props)`.
pub fn rich_text_editor(props: impl IntoValue) -> D {
    component(&crate::components::RICH_TEXT_EDITOR, props)
}

/// `loadContent(slug)`: an access hook loading a guide page's Markdown and headings.
pub fn load_content(slug: D) -> D {
    access(D::V(obj! { "effects": arr![function("FunctionType.Effect", "LoadContent", vec![slug])] }))
}

// patternStep ------------------------------------------------------------------------------

/// Where the pattern demos' sources live (`readPatternSource`); the code panels show them.
fn patterns_root() -> PathBuf {
    std::env::var_os("FORGE_GUIDE_PATTERNS").map(Into::into).unwrap_or_else(|| crate::app::AppPaths::from_env().patterns_dir())
}

fn read_pattern_source(relative: &str) -> String {
    let full = patterns_root().join(relative);
    std::fs::read_to_string(&full).unwrap_or_else(|e| panic!("Pattern source not found: {relative} ({}): {e}", full.display()))
}

fn infer_language(path: &str) -> &'static str {
    match path.rsplit_once('.').map(|(_, e)| e.to_lowercase()).as_deref() {
        Some("rs") => "rust",
        Some("ts" | "mts" | "cts") => "typescript",
        Some("js" | "mjs" | "cjs") => "javascript",
        Some("njk") => "nunjucks",
        Some("html" | "xml") => "html",
        Some("json") => "json",
        Some("sh" | "bash") => "bash",
        Some("yaml" | "yml") => "yaml",
        _ => "plaintext",
    }
}

fn escape_html(value: &str) -> String {
    value.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;").replace('\'', "&#39;")
}

/// `highlightCode`.
fn highlight_code(source: &str, language: &str) -> String {
    const REGISTERED: &[&str] = &["rust", "typescript", "javascript", "html", "json", "bash", "yaml", "nunjucks"];
    let lang = if REGISTERED.contains(&language) { language } else { "plaintext" };
    let highlighted = match lang {
        "plaintext" => escape_html(source),
        _ => crate::highlight::highlight_value(source, lang, true).unwrap_or_else(|| escape_html(source)),
    };
    format!("<pre><code class=\"hljs language-{lang}\">{highlighted}</code></pre>")
}

/// The `effect!("Name", ...)` registrations named in `names`, in the order given.
fn extract_effects(source: &str, names: &Value) -> String {
    let lines: Vec<&str> = source.split('\n').collect();
    names
        .as_array()
        .map(|ns| {
            ns.iter()
                .filter_map(|n| {
                    let marker = format!("effect!(\"{}\",", n.to_js_string());
                    let start = lines.iter().position(|l| l.trim_start().starts_with(&marker))?;
                    let indent = &lines[start][..lines[start].len() - lines[start].trim_start().len()];
                    let close = format!("{indent}}}),");
                    let end = lines[start..].iter().position(|l| *l == close).map_or(lines.len(), |i| start + i + 1);
                    Some(lines[start..end].iter().map(|l| l.strip_prefix(indent).unwrap_or(l)).collect::<Vec<_>>().join("\n"))
                })
                .collect::<Vec<_>>()
                .join("\n\n// ...\n\n")
        })
        .unwrap_or_default()
}

fn extract_line_ranges(source: &str, ranges: &Value) -> String {
    let lines: Vec<&str> = source.split('\n').collect();
    ranges
        .as_array()
        .map(|rs| {
            rs.iter()
                .map(|r| {
                    let start = (r.get("0").as_f64().unwrap_or(1.0) as i64 - 1).max(0) as usize;
                    let end = (r.get("1").as_f64().unwrap_or(0.0) as usize).min(lines.len());
                    lines.get(start..end.max(start)).unwrap_or(&[]).join("\n")
                })
                .collect::<Vec<_>>()
                .join("\n\n// ...\n\n")
        })
        .unwrap_or_default()
}

/// `path.posix.join(base, p)` for the relative paths the demos use (`..` and `.` resolved).
fn posix_join(base: &str, p: &str) -> String {
    let mut parts: Vec<&str> = Vec::new();
    for seg in base.split('/').chain(p.split('/')) {
        match seg {
            "" | "." => {}
            ".." => {
                parts.pop();
            }
            s => parts.push(s),
        }
    }
    parts.join("/")
}

/// Demo sources per pattern, as `patternStep` resolves them (`PatternSourceStore`), for llms.txt.
static PATTERN_SOURCES: LazyLock<std::sync::Mutex<indexmap::IndexMap<String, Vec<(String, String)>>>> =
    LazyLock::new(Default::default);

/// `registerPanel`: first registration of a display path wins.
fn register_panel(pattern: &str, display_path: &str, source: &str) {
    let mut sources = PATTERN_SOURCES.lock().unwrap();
    let files = sources.entry(pattern.to_string()).or_default();
    if !files.iter().any(|(p, _)| p == display_path) {
        files.push((display_path.to_string(), source.to_string()));
    }
}

/// `PatternSourceStore.getDemo(pattern)`: the demo files the pattern's steps show. Filled while
/// the guide journey is built.
pub fn pattern_demo_sources(pattern: &str) -> Vec<(String, String)> {
    PATTERN_SOURCES.lock().unwrap().get(pattern).cloned().unwrap_or_default()
}

fn resolve_panel(spec: &Value, source_base: Option<&str>) -> Value {
    let (label, raw_path, language, lines) = match spec {
        Value::String(s) => (Value::Undefined, s.to_string(), Value::Undefined, Value::Undefined),
        o => (o.get("label"), o.get("path").to_js_string(), o.get("language"), o.get("lines")),
    };
    let effects = spec.get("effects");
    let resolved = match (raw_path.strip_prefix('/'), source_base) {
        (Some(abs), _) => abs.to_string(),
        (None, Some(base)) => posix_join(base, &raw_path),
        (None, None) => raw_path.clone(),
    };
    let language = language.as_str().map(str::to_string).unwrap_or_else(|| infer_language(&resolved).to_string());
    let source = read_pattern_source(&resolved);
    let sliced = if !effects.is_undefined() {
        extract_effects(&source, &effects)
    } else if lines.is_undefined() {
        source
    } else {
        extract_line_ranges(&source, &lines)
    };
    let display = sliced;
    if let Some(base) = source_base {
        let pattern = base.split('/').next().unwrap_or_default();
        register_panel(pattern, raw_path.strip_prefix('/').unwrap_or(&raw_path), &display);
    }
    let label = match label {
        Value::String(l) => l.to_string(),
        _ => resolved.rsplit('/').next().unwrap_or_default().to_string(),
    };
    Value::from_pairs([("label", Value::from(label)), ("html", Value::from(highlight_code(&display, &language)))])
}

/// `patternStep(props)`: a step rendered with the pattern layout and the demo's code panels.
pub fn pattern_step(props: impl IntoValue) -> D {
    let props = props.into_value();
    let source_base = props.get("sourceBase").as_str().map(str::to_string);
    let panels: Vec<Value> = props
        .get("codeFiles")
        .as_array()
        .map(|files| files.iter().map(|spec| resolve_panel(spec, source_base.as_deref())).collect())
        .unwrap_or_default();
    let mut rest = props.as_object().map(|o| (**o).clone()).unwrap_or_default();
    for key in ["sourceBase", "codeFiles", "templateLocals"] {
        rest.shift_remove(key);
    }
    let mut locals = match props.get("templateLocals") {
        Value::Object(o) => (*o).clone(),
        _ => Default::default(),
    };
    locals.insert("codePanels".into(), Value::array(panels));
    rest.insert(
        "view".into(),
        Value::from_pairs([("template", Value::from("partials/pattern-step")), ("locals", Value::object(locals))]),
    );
    step(D::V(Value::object(rest)))
}
