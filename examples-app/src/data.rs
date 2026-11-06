//! The guide's data services (`server/data/*`): Markdown content, form answers, mock APIs.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use forge_core::Value;
use forge_core::value::Map;

#[derive(Clone, Debug)]
pub struct ContentEntry {
    pub slug: String,
    pub section: Option<String>,
    pub path: String,
    pub title: String,
    pub tags: Vec<String>,
    pub markdown: String,
}

#[derive(Clone, Debug, PartialEq)]
pub struct HeadingEntry {
    pub text: String,
    pub slug: String,
}

impl HeadingEntry {
    pub fn to_value(&self) -> Value {
        Value::from_pairs([("text", Value::from(self.text.as_str())), ("slug", Value::from(self.slug.as_str()))])
    }
}

/// `slugifyHeading`.
pub fn slugify_heading(text: &str) -> String {
    let lower = text.to_lowercase();
    let kept: String = lower.chars().filter(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c.is_whitespace() || *c == '-').collect();
    let mut out = String::new();
    let mut last_dash = false;
    for c in kept.chars() {
        let c = if c.is_whitespace() { '-' } else { c };
        if c == '-' {
            if !last_dash {
                out.push('-');
            }
            last_dash = true;
        } else {
            out.push(c);
            last_dash = false;
        }
    }
    out.trim_matches('-').to_string()
}

enum Attr {
    Text(String),
    List(Vec<String>),
}

/// `parseFrontmatter`: `key: value` and `key: [a, b]` lines between `---` fences.
fn parse_frontmatter(raw: &str) -> Option<(HashMap<String, Attr>, String)> {
    if !raw.starts_with("---") {
        return None;
    }
    let end = raw[3..].find("---")? + 3;
    let mut attrs = HashMap::new();
    for line in raw[3..end].trim().split('\n') {
        let Some(colon) = line.find(':') else { continue };
        let key = line[..colon].trim().to_string();
        let value = line[colon + 1..].trim();
        if value.starts_with('[') && value.ends_with(']') && value.len() >= 2 {
            let items = value[1..value.len() - 1].split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
            attrs.insert(key, Attr::List(items));
        } else {
            attrs.insert(key, Attr::Text(value.to_string()));
        }
    }
    Some((attrs, raw[end + 3..].trim().to_string()))
}

/// `GuideContentStore`: every `*.md` under the content directory with `title` and `path`
/// frontmatter, keyed by file name (files starting `_` are partials and skipped).
pub struct GuideContentStore {
    entries: indexmap::IndexMap<String, ContentEntry>,
}

fn walk(dir: &Path, out: &mut Vec<PathBuf>) {
    let Ok(read) = std::fs::read_dir(dir) else { return };
    let mut paths: Vec<PathBuf> = read.flatten().map(|e| e.path()).collect();
    paths.sort();
    for p in paths {
        if p.is_dir() {
            walk(&p, out);
        } else {
            out.push(p);
        }
    }
}

impl GuideContentStore {
    pub fn load(content_dir: impl AsRef<Path>) -> Result<Self, String> {
        let mut files = Vec::new();
        walk(content_dir.as_ref(), &mut files);
        let mut entries = indexmap::IndexMap::new();
        for file in files {
            let name = file.file_name().and_then(|n| n.to_str()).unwrap_or_default();
            if !name.ends_with(".md") || name.starts_with('_') {
                continue;
            }
            let slug = name.trim_end_matches(".md").to_string();
            let raw = std::fs::read_to_string(&file).map_err(|e| format!("{}: {e}", file.display()))?;
            let Some((attrs, body)) = parse_frontmatter(&raw) else { continue };
            let text = |k: &str| match attrs.get(k) {
                Some(Attr::Text(t)) => Some(t.clone()),
                _ => None,
            };
            let (Some(title), Some(path)) = (text("title"), text("path")) else { continue };
            if entries.contains_key(&slug) {
                return Err(format!("Duplicate guide content slug \"{slug}\""));
            }
            let tags = match attrs.get("teaches") {
                Some(Attr::List(l)) => l.clone(),
                _ => vec![],
            };
            entries.insert(slug.clone(), ContentEntry { slug, section: text("section"), path, title, tags, markdown: body });
        }
        Ok(Self { entries })
    }

    pub fn get(&self, slug: &str) -> Option<&ContentEntry> {
        self.entries.get(slug)
    }

    /// `## ` headings of an entry, for the table of contents.
    pub fn headings(&self, slug: &str) -> Vec<HeadingEntry> {
        let Some(entry) = self.entries.get(slug) else { return vec![] };
        entry
            .markdown
            .lines()
            .filter_map(|l| l.strip_prefix("## "))
            .filter(|t| !t.is_empty())
            .map(|t| HeadingEntry { text: t.to_string(), slug: slugify_heading(t) })
            .collect()
    }

    pub fn all(&self) -> impl Iterator<Item = &ContentEntry> {
        self.entries.values()
    }
}

/// `FormDataStore`: committed pattern answers per session and pattern, expiring after an hour.
/// TS keeps these in Redis and, with Redis disabled, keeps none; this port keeps them in process
/// unless disabled (`FORM_DATA_STORE=none` matches TS without Redis).
pub struct FormDataStore {
    enabled: bool,
    entries: Mutex<HashMap<(String, String), (Instant, Map)>>,
}

impl Default for FormDataStore {
    fn default() -> Self {
        Self::new(true)
    }
}

const FORM_DATA_TTL: Duration = Duration::from_secs(60 * 60);

impl FormDataStore {
    pub fn new(enabled: bool) -> Self {
        Self { enabled, entries: Mutex::default() }
    }

    /// From `FORM_DATA_STORE` (`none` disables persistence).
    pub fn from_env() -> Self {
        Self::new(std::env::var("FORM_DATA_STORE").as_deref() != Ok("none"))
    }

    pub fn get(&self, session_id: &str, form_code: &str) -> Option<Map> {
        if !self.enabled {
            return None;
        }
        let mut entries = self.entries.lock().unwrap();
        let key = (session_id.to_string(), form_code.to_string());
        match entries.get(&key) {
            Some((at, _)) if at.elapsed() > FORM_DATA_TTL => {
                entries.remove(&key);
                None
            }
            Some((_, data)) => Some(data.clone()),
            None => None,
        }
    }

    /// Merges `answers` over what is stored (`{ ...existing, ...answers }`).
    pub fn set(&self, session_id: &str, form_code: &str, answers: Map) {
        if !self.enabled {
            return;
        }
        let mut merged = self.get(session_id, form_code).unwrap_or_default();
        for (k, v) in answers {
            // JSON.stringify drops undefined values.
            if v.is_undefined() {
                merged.shift_remove(&k);
            } else {
                merged.insert(k, v);
            }
        }
        self.entries.lock().unwrap().insert((session_id.to_string(), form_code.to_string()), (Instant::now(), merged));
    }

    pub fn delete(&self, session_id: &str, form_code: &str) {
        if !self.enabled {
            return;
        }
        self.entries.lock().unwrap().remove(&(session_id.to_string(), form_code.to_string()));
    }
}

pub struct AddressResult {
    pub line1: &'static str,
    pub line2: &'static str,
    pub town: &'static str,
    pub county: &'static str,
    pub postcode: String,
}

pub struct LotteryDraw {
    pub balls: Vec<u32>,
    pub bonus_ball: u32,
    pub draw_date: String,
}

/// `MocksApi`: canned address lookups and a random lottery draw.
#[derive(Default)]
pub struct MocksApi;

/// A small xorshift RNG seeded from the clock; the demos only need variety.
fn random_below(n: u32) -> u32 {
    use std::sync::atomic::{AtomicU64, Ordering};
    static STATE: AtomicU64 = AtomicU64::new(0);
    let mut x = STATE.load(Ordering::Relaxed);
    if x == 0 {
        x = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos() as u64).unwrap_or(1) | 1;
    }
    x ^= x << 13;
    x ^= x >> 7;
    x ^= x << 17;
    STATE.store(x, Ordering::Relaxed);
    (x % n as u64) as u32
}

impl MocksApi {
    pub fn lookup_address(&self, postcode: &str) -> AddressResult {
        let normalised: String = postcode.chars().filter(|c| !c.is_whitespace()).collect::<String>().to_uppercase();
        match normalised.as_str() {
            "SW1A1AA" => AddressResult { line1: "Buckingham Palace", line2: "The Mall", town: "London", county: "Greater London", postcode: "SW1A 1AA".into() },
            "SW1A2AA" => AddressResult { line1: "House of Commons", line2: "Parliament Square", town: "London", county: "Greater London", postcode: "SW1A 2AA".into() },
            "LS12BJ" => AddressResult { line1: "2 Lisbon Street", line2: "", town: "Leeds", county: "West Yorkshire", postcode: "LS1 2BJ".into() },
            _ => AddressResult { line1: "10 Imaginary Lane", line2: "", town: "Exampton", county: "Testshire", postcode: postcode.to_uppercase() },
        }
    }

    pub fn lottery_balls(&self) -> LotteryDraw {
        let mut balls: Vec<u32> = Vec::new();
        while balls.len() < 6 {
            let n = random_below(59) + 1;
            if !balls.contains(&n) {
                balls.push(n);
            }
        }
        let bonus_ball = loop {
            let n = random_below(59) + 1;
            if !balls.contains(&n) {
                break n;
            }
        };
        let draw_date = long_date(true);
        LotteryDraw { balls, bonus_ball, draw_date }
    }
}

/// `new Date().toLocaleDateString('en-GB', { [weekday: 'long',] day: 'numeric', month: 'long', year: 'numeric' })`:
/// "4 November 2026", or "Wednesday, 4 November 2026" with the weekday (unlike `dateStyle: 'full'`,
/// the component form puts a comma after it).
pub fn long_date(weekday: bool) -> String {
    use forge_core::jsdate::{DateFormatOptions, JsDate, intl_format_date};
    const WEEKDAYS: [&str; 7] = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    let now = JsDate::now();
    let opts = DateFormatOptions { locale: Some("en-GB".into()), date_style: Some("long".into()), ..Default::default() };
    let date = intl_format_date(&now, &opts).unwrap_or_default();
    match now.local_fields() {
        Some(f) if weekday => format!("{}, {date}", WEEKDAYS[f.weekday as usize]),
        _ => date,
    }
}
