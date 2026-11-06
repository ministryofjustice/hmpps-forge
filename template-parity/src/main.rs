//! Template parity spike: renders every corpus case through Runjucks and diffs it against
//! the HTML real Nunjucks produced for the same template, params and environment.
//!
//! Usage: cargo run --release -p template-parity -- [corpus.json] [report-dir]

use std::collections::BTreeMap;
use std::fs;
use std::panic::{self, AssertUnwindSafe};
use std::path::{Component, Path, PathBuf};
use std::sync::{Arc, LazyLock};

use chrono::{DateTime, Timelike, Utc};
use regex::Regex;
use runjucks_core::{Environment, RunjucksError, TemplateLoader};
use serde::Deserialize;
use serde_json::{Value, json};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Corpus {
    search_paths: Vec<PathBuf>,
    cases: Vec<Case>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Case {
    id: String,
    library: String,
    component: String,
    params: Value,
    source: String,
    nunjucks: NunjucksResult,
}

#[derive(Deserialize)]
struct NunjucksResult {
    ok: bool,
    html: Option<String>,
}

/// Loader over several search roots (like Nunjucks' FileSystemLoader with an array).
///
/// Runjucks resolves every template name from the loader root, but govuk-frontend and MOJ
/// use `./x` and `../../x` paths that Nunjucks resolves against the *including* template.
/// The loader rewrites those to root-relative names as each file is loaded.
struct SearchPathLoader {
    roots: Vec<PathBuf>,
}

static TAG_PATH: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r#"(\{%-?\s*(?:include|import|from|extends)\s+)["'](\.\.?/[^"']+)["']"#).unwrap()
});

impl SearchPathLoader {
    fn rewrite_relative(name: &str, source: &str) -> String {
        let dir = Path::new(name).parent().unwrap_or(Path::new(""));
        TAG_PATH
            .replace_all(source, |c: &regex::Captures| {
                format!("{}\"{}\"", &c[1], normalise(&dir.join(&c[2])))
            })
            .into_owned()
    }
}

fn normalise(path: &Path) -> String {
    let mut parts: Vec<&str> = Vec::new();
    for c in path.components() {
        match c {
            Component::Normal(s) => parts.push(s.to_str().unwrap()),
            Component::ParentDir => {
                parts.pop();
            }
            _ => {}
        }
    }
    parts.join("/")
}

impl TemplateLoader for SearchPathLoader {
    fn load(&self, name: &str) -> Result<String, RunjucksError> {
        for root in &self.roots {
            if let Ok(src) = fs::read_to_string(root.join(name)) {
                return Ok(Self::rewrite_relative(name, &src));
            }
        }
        Err(RunjucksError::new(format!("template not found: {name}")))
    }

    fn cache_key(&self, name: &str) -> Option<String> {
        Some(name.to_string())
    }

    fn cache_keys_are_stable(&self) -> bool {
        true
    }
}

/// Port of MOJ frontend's `mojDate` filter (moj/filters/all.js), UTC only.
fn moj_date(value: &Value, args: &[Value]) -> Result<Value, RunjucksError> {
    let raw = value.as_str().unwrap_or_default();
    let Ok(t) = DateTime::parse_from_rfc3339(raw).map(|t| t.with_timezone(&Utc)) else {
        return Ok(value.clone());
    };
    let date = || t.format("%-d %B %Y").to_string();
    let short = || t.format("%-d %b %Y").to_string();
    let time = || {
        let fmt = if t.minute() > 0 { "%-I:%M%P" } else { "%-I%P" };
        t.format(fmt).to_string()
    };
    let out = match args.first().and_then(Value::as_str) {
        Some("datetime") => format!("{} at {}", date(), time()),
        Some("shortdatetime") => format!("{} at {}", short(), time()),
        Some("date") => date(),
        Some("shortdate") => short(),
        Some("time") => time(),
        _ => return Ok(value.clone()),
    };
    Ok(Value::String(out))
}

/// Port of MOJ frontend's `date` filter (moment format strings), common tokens only, UTC only.
fn moment_date(value: &Value, args: &[Value]) -> Result<Value, RunjucksError> {
    static TOKENS: LazyLock<Regex> =
        LazyLock::new(|| Regex::new(r"YYYY|MMMM|MMM|MM|DD|D|HH|hh|h|mm|ss|a").unwrap());
    let raw = value.as_str().unwrap_or_default();
    let Ok(t) = DateTime::parse_from_rfc3339(raw).map(|t| t.with_timezone(&Utc)) else {
        return Ok(Value::String("Invalid date".into()));
    };
    let format = args.first().and_then(Value::as_str).unwrap_or("YYYY-MM-DDTHH:mm:ssZ");
    let strftime = TOKENS.replace_all(format, |c: &regex::Captures| {
        match &c[0] {
            "YYYY" => "%Y", "MMMM" => "%B", "MMM" => "%b", "MM" => "%m", "DD" => "%d", "D" => "%-d",
            "HH" => "%H", "hh" => "%I", "h" => "%-I", "mm" => "%M", "ss" => "%S", _ => "%P",
        }
        .to_string()
    });
    Ok(Value::String(t.format(&strftime).to_string()))
}

/// Whitespace-insensitive form: collapses runs of whitespace and drops whitespace between tags.
fn loose(html: &str) -> String {
    static WS: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\s+").unwrap());
    static BETWEEN: LazyLock<Regex> = LazyLock::new(|| Regex::new(r">\s+<").unwrap());
    static INNER: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(>)\s+|\s+(<)").unwrap());
    let s = WS.replace_all(html.trim(), " ");
    let s = BETWEEN.replace_all(&s, "><");
    INNER.replace_all(&s, "$1$2").into_owned()
}

enum Outcome {
    Exact,
    WhitespaceOnly,
    Mismatch { expected: String, actual: String },
    Error(String),
    Panic(String),
    Skipped,
}

fn first_difference(a: &str, b: &str) -> String {
    let at = a.chars().zip(b.chars()).take_while(|(x, y)| x == y).count();
    let window = |s: &str| {
        let start = at.saturating_sub(60);
        s.chars().skip(start).take(160).collect::<String>()
    };
    format!(
        "first difference at char {at}\n  nunjucks: {:?}\n  runjucks: {:?}",
        window(a),
        window(b)
    )
}

fn main() {
    let mut args = std::env::args().skip(1);
    let corpus_path = args.next().unwrap_or_else(|| "corpus/corpus.json".into());
    let report_dir = PathBuf::from(args.next().unwrap_or_else(|| "report".into()));
    let corpus: Corpus = serde_json::from_str(&fs::read_to_string(&corpus_path).unwrap()).unwrap();

    let mut env = Environment::default();
    env.autoescape = true;
    // Relative search paths are relative to the rust/ workspace.
    let workspace = PathBuf::from(concat!(env!("CARGO_MANIFEST_DIR"), "/.."));
    let roots = corpus.search_paths.iter().map(|p| if p.is_absolute() { p.clone() } else { workspace.join(p) }).collect();
    env.loader = Some(Arc::new(SearchPathLoader { roots }));
    env.add_filter("mojDate", Arc::new(moj_date));
    env.add_filter("date", Arc::new(moment_date));

    panic::set_hook(Box::new(|_| {}));

    // component -> [exact, whitespace-only, mismatch, error, panic, total]
    let mut by_component: BTreeMap<String, [usize; 6]> = BTreeMap::new();
    let mut failures = String::new();

    for case in &corpus.cases {
        let outcome = match (&case.nunjucks.ok, &case.nunjucks.html) {
            (true, Some(expected)) => {
                let ctx = json!({ "params": case.params });
                match panic::catch_unwind(AssertUnwindSafe(|| env.render_string(case.source.clone(), ctx))) {
                    Ok(Ok(actual)) if std::env::var("DUMP").is_ok_and(|d| d == case.id) => {
                        fs::write("dump.nunjucks.html", expected).unwrap();
                        fs::write("dump.runjucks.html", &actual).unwrap();
                        if &actual == expected { Outcome::Exact } else { Outcome::WhitespaceOnly }
                    }
                    Ok(Ok(actual)) if &actual == expected => Outcome::Exact,
                    Ok(Ok(actual)) if loose(&actual) == loose(expected) => Outcome::WhitespaceOnly,
                    Ok(Ok(actual)) => Outcome::Mismatch { expected: expected.clone(), actual },
                    Ok(Err(e)) => Outcome::Error(e.to_string()),
                    Err(p) => Outcome::Panic(
                        p.downcast_ref::<String>().cloned()
                            .or_else(|| p.downcast_ref::<&str>().map(|s| s.to_string()))
                            .unwrap_or_default(),
                    ),
                }
            }
            _ => Outcome::Skipped,
        };

        let key = format!("{}/{}", case.library, case.component);
        let row = by_component.entry(key).or_default();
        row[5] += 1;
        match outcome {
            Outcome::Exact => row[0] += 1,
            Outcome::WhitespaceOnly => row[1] += 1,
            Outcome::Mismatch { expected, actual } => {
                row[2] += 1;
                failures += &format!(
                    "## MISMATCH {}\n{}\n  loose: {}\n\n",
                    case.id,
                    first_difference(&expected, &actual),
                    first_difference(&loose(&expected), &loose(&actual))
                );
            }
            Outcome::Error(e) => {
                row[3] += 1;
                failures += &format!("## ERROR {}\n  {e}\n\n", case.id);
            }
            Outcome::Panic(p) => {
                row[4] += 1;
                failures += &format!("## PANIC {}\n  {p}\n\n", case.id);
            }
            Outcome::Skipped => {}
        }
    }

    let mut summary = String::from(
        "| component | cases | exact | whitespace-only | mismatch | error | panic |\n|---|---|---|---|---|---|---|\n",
    );
    let mut totals = [0usize; 6];
    for (component, r) in &by_component {
        summary += &format!("| {component} | {} | {} | {} | {} | {} | {} |\n", r[5], r[0], r[1], r[2], r[3], r[4]);
        for i in 0..6 {
            totals[i] += r[i];
        }
    }
    summary += &format!(
        "| **total** | {} | {} | {} | {} | {} | {} |\n",
        totals[5], totals[0], totals[1], totals[2], totals[3], totals[4]
    );

    fs::create_dir_all(&report_dir).unwrap();
    fs::write(report_dir.join("summary.md"), &summary).unwrap();
    fs::write(report_dir.join("failures.md"), &failures).unwrap();
    println!("{summary}");
}
