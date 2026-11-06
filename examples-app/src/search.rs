//! Guide search (`server/data/guideSearch.ts`), keyword half: chunking, a BM25+ index over
//! title/heading/tags/text with MiniSearch's boosts, page grouping and highlighted excerpts.
//! The TS hybrid (embedding) ranking is not ported; TS falls back to exactly this path when
//! its embedding index is not ready.

use std::collections::{HashMap, HashSet};
use std::sync::LazyLock;

use forge_core::Value;
use regex::Regex;
use rust_stemmers::{Algorithm, Stemmer};

use crate::data::{ContentEntry, GuideContentStore, slugify_heading};

const MAX_BODY_CHARS: usize = 1000;
const OVERLAP_CHARS: usize = 200;
const MIN_CHUNK_CHARS: usize = 50;
const MAX_RESULTS: usize = 25;
const MAX_PAGES: usize = 8;
const MAX_SECTIONS_PER_PAGE: usize = 4;
const EXCERPT_MAX_LENGTH: usize = 300;
const EXCERPT_CONTEXT_CHARS: usize = 80;

#[derive(Clone, Debug)]
pub struct GuideChunk {
    pub slug: String,
    pub path: String,
    pub title: String,
    pub tags: Vec<String>,
    pub heading: String,
    pub heading_path: String,
    pub text: String,
}

struct Section {
    heading: String,
    heading_path: String,
    body: String,
}

fn re(s: &str) -> Regex {
    Regex::new(s).unwrap()
}

static HEADING: LazyLock<Regex> = LazyLock::new(|| re(r"(?m)^(#{2,3}) (.+)$"));

fn split_into_sections(markdown: &str) -> Vec<Section> {
    let matches: Vec<_> = HEADING.captures_iter(markdown).collect();
    if matches.is_empty() {
        let body = markdown.trim();
        return if body.is_empty() {
            vec![]
        } else {
            vec![Section { heading: "Introduction".into(), heading_path: "Introduction".into(), body: body.into() }]
        };
    }
    let mut sections = Vec::new();
    let preamble = markdown[..matches[0].get(0).unwrap().start()].trim();
    if !preamble.is_empty() {
        sections.push(Section { heading: "Introduction".into(), heading_path: "Introduction".into(), body: preamble.into() });
    }
    let mut current_h2: Option<String> = None;
    for (i, m) in matches.iter().enumerate() {
        let level = m[1].len();
        let heading = m[2].trim().to_string();
        let start = m.get(0).unwrap().end();
        let end = matches.get(i + 1).map_or(markdown.len(), |n| n.get(0).unwrap().start());
        let body = markdown[start..end].trim().to_string();
        if level == 2 {
            current_h2 = Some(heading.clone());
        }
        if body.is_empty() {
            continue;
        }
        let heading_path = match (&current_h2, level) {
            (_, 2) => heading.clone(),
            (Some(h2), _) => format!("{h2} > {heading}"),
            (None, _) => heading.clone(),
        };
        sections.push(Section { heading, heading_path, body });
    }
    sections
}

/// JS `length`/`slice` work in UTF-16 units; the guide is ASCII-heavy, so chars are used.
fn char_len(s: &str) -> usize {
    s.encode_utf16().count()
}

fn slice_utf16(s: &str, start: usize, end: usize) -> String {
    let units: Vec<u16> = s.encode_utf16().collect();
    let end = end.min(units.len());
    if start >= end {
        return String::new();
    }
    String::from_utf16_lossy(&units[start..end])
}

fn split_body_with_overlap(body: &str, max: usize, overlap: usize) -> Vec<String> {
    if char_len(body) <= max {
        return vec![body.into()];
    }
    static PARAS: LazyLock<Regex> = LazyLock::new(|| re(r"\n\n+"));
    let paragraphs: Vec<&str> = PARAS.split(body).map(str::trim).filter(|p| !p.is_empty()).collect();
    if paragraphs.is_empty() {
        return vec![body.into()];
    }
    let mut chunks = Vec::new();
    let mut current: Vec<String> = Vec::new();
    let mut current_len = 0;
    for paragraph in paragraphs {
        let plen = char_len(paragraph);
        if plen > max {
            if !current.is_empty() {
                chunks.push(current.join("\n\n"));
                current.clear();
                current_len = 0;
            }
            let mut i = 0;
            while i < plen {
                chunks.push(slice_utf16(paragraph, i, i + max));
                i += max - overlap;
            }
            continue;
        }
        let sep = if current.is_empty() { 0 } else { 2 };
        if current_len + sep + plen > max && !current.is_empty() {
            chunks.push(current.join("\n\n"));
            let last = current.last().unwrap().clone();
            if char_len(&last) <= overlap {
                current_len = char_len(&last) + 2 + plen;
                current = vec![last, paragraph.into()];
            } else {
                current = vec![paragraph.into()];
                current_len = plen;
            }
            continue;
        }
        current.push(paragraph.into());
        current_len += sep + plen;
    }
    if !current.is_empty() {
        chunks.push(current.join("\n\n"));
    }
    chunks
}

pub fn chunk_entries<'a>(entries: impl IntoIterator<Item = &'a ContentEntry>) -> Vec<GuideChunk> {
    let mut out = Vec::new();
    for entry in entries {
        for section in split_into_sections(&entry.markdown) {
            for text in split_body_with_overlap(&section.body, MAX_BODY_CHARS, OVERLAP_CHARS) {
                if char_len(&text) >= MIN_CHUNK_CHARS {
                    out.push(GuideChunk {
                        slug: entry.slug.clone(),
                        path: entry.path.clone(),
                        title: entry.title.clone(),
                        tags: entry.tags.clone(),
                        heading: section.heading.clone(),
                        heading_path: section.heading_path.clone(),
                        text,
                    });
                }
            }
        }
    }
    out
}

fn apply(text: &str, rules: &[(&Regex, &str)]) -> String {
    let mut s = text.to_string();
    for (r, with) in rules {
        s = r.replace_all(&s, *with).into_owned();
    }
    s
}

static FENCE: LazyLock<Regex> = LazyLock::new(|| re(r"```[\s\S]*?```"));
static SLOT: LazyLock<Regex> = LazyLock::new(|| re(r"\{\{slot:[^}]*\}\}"));
static TAG: LazyLock<Regex> = LazyLock::new(|| re(r"<[^>]+>"));
static CODE: LazyLock<Regex> = LazyLock::new(|| re(r"`([^`]+)`"));
static LINK: LazyLock<Regex> = LazyLock::new(|| re(r"\[([^\]]+)\]\([^)]+\)"));
static BLANKS: LazyLock<Regex> = LazyLock::new(|| re(r"\n{2,}"));

fn strip_markdown(text: &str) -> String {
    static TABLE_ROW: LazyLock<Regex> = LazyLock::new(|| re(r"(?m)^\|.*\|$"));
    static TABLE_RULE: LazyLock<Regex> = LazyLock::new(|| re(r"(?m)^[-|: ]+$"));
    static QUOTE: LazyLock<Regex> = LazyLock::new(|| re(r"(?m)^>\s?"));
    static EMPH: LazyLock<Regex> = LazyLock::new(|| re(r"[*_~#]"));
    apply(
        text,
        &[
            (&FENCE, ""),
            (&SLOT, ""),
            (&TAG, ""),
            (&CODE, "$1"),
            (&LINK, "$1"),
            (&TABLE_ROW, ""),
            (&TABLE_RULE, ""),
            (&QUOTE, ""),
            (&EMPH, ""),
            (&BLANKS, "\n"),
        ],
    )
    .trim()
    .to_string()
}

fn clean_text_for_excerpt(text: &str) -> String {
    static HEADINGS: LazyLock<Regex> = LazyLock::new(|| re(r"(?m)^#+\s+.*"));
    static MARKS: LazyLock<Regex> = LazyLock::new(|| re(r"[*_~|>#-]"));
    apply(
        text,
        &[(&HEADINGS, ""), (&FENCE, ""), (&SLOT, ""), (&TAG, ""), (&CODE, "$1"), (&LINK, "$1"), (&MARKS, ""), (&BLANKS, "\n")],
    )
    .trim()
    .to_string()
}

static STEMMER: LazyLock<Stemmer> = LazyLock::new(|| Stemmer::create(Algorithm::English));

/// `processSearchTerm`: lowercase, drop 1-char terms, index both the word and its stem.
fn process_term(term: &str) -> Vec<String> {
    let lower = term.to_lowercase();
    if lower.chars().count() < 2 {
        return vec![];
    }
    let stem = STEMMER.stem(&lower).into_owned();
    if stem == lower { vec![lower] } else { vec![lower, stem] }
}

/// MiniSearch's default tokenizer: split on whitespace and punctuation.
fn tokenize(text: &str) -> impl Iterator<Item = &str> {
    text.split(|c: char| c.is_whitespace() || (!c.is_alphanumeric())).filter(|t| !t.is_empty())
}

fn tokenize_query(query: &str) -> Vec<String> {
    query
        .to_lowercase()
        .split_whitespace()
        .map(|t| t.chars().filter(|c| c.is_alphanumeric()).collect::<String>())
        .filter(|t| t.chars().count() >= 2)
        .collect()
}

pub fn escape_html(value: &str) -> String {
    value.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;").replace('\'', "&#39;")
}

fn take_lines(text: &str, max: usize) -> String {
    let mut result = String::new();
    for line in text.split('\n').filter(|l| !l.trim().is_empty()) {
        let candidate = if result.is_empty() { line.to_string() } else { format!("{result} {line}") };
        if char_len(&candidate) > max {
            break;
        }
        result = candidate;
    }
    result
}

fn pick_snippet(text: &str, terms: &[String], max: usize) -> String {
    if terms.is_empty() {
        return take_lines(text, max);
    }
    let lowered = text.to_lowercase();
    let first = terms.iter().filter_map(|t| lowered.find(&t.to_lowercase())).min();
    // Byte offsets into the lowercased copy; convert to UTF-16 to mirror the JS indices.
    let first = first.map(|b| char_len(&lowered[..b]));
    match first {
        None => take_lines(text, max),
        Some(i) if i < EXCERPT_CONTEXT_CHARS => take_lines(text, max),
        Some(i) => {
            let window_start = i.saturating_sub(EXCERPT_CONTEXT_CHARS);
            let tail = slice_utf16(text, window_start, usize::MAX);
            let adjusted = match tail.find(' ') {
                Some(b) => window_start + char_len(&tail[..b]) + 1,
                None => window_start,
            };
            slice_utf16(text, adjusted, adjusted + max).trim().to_string()
        }
    }
}

fn highlight_terms(escaped: &str, terms: &[String]) -> String {
    if terms.is_empty() {
        return escaped.into();
    }
    let alternatives: Vec<String> = terms.iter().map(|t| regex::escape(t)).collect();
    let pattern = Regex::new(&format!(r"(?i)\b({})\b", alternatives.join("|"))).unwrap();
    pattern.replace_all(escaped, "<mark>$1</mark>").into_owned()
}

pub fn build_excerpt(text: &str, terms: &[String]) -> String {
    let cleaned = clean_text_for_excerpt(text);
    if cleaned.is_empty() {
        return String::new();
    }
    let snippet = pick_snippet(&cleaned, terms, EXCERPT_MAX_LENGTH);
    if snippet.is_empty() {
        return String::new();
    }
    format!("{}...", highlight_terms(&escape_html(&snippet), terms))
}

const FIELDS: usize = 4;
const BOOSTS: [f64; FIELDS] = [3.0, 2.0, 2.0, 1.0];
// MiniSearch's BM25+ defaults.
const K: f64 = 1.2;
const B: f64 = 0.7;
const D: f64 = 0.5;

/// A BM25+ inverted index over the four MiniSearch fields.
struct KeywordIndex {
    /// term -> field -> doc -> term frequency
    postings: HashMap<String, [HashMap<usize, f64>; FIELDS]>,
    field_lengths: Vec<[f64; FIELDS]>,
    avg_lengths: [f64; FIELDS],
}

impl KeywordIndex {
    fn build(chunks: &[GuideChunk]) -> Self {
        let mut postings: HashMap<String, [HashMap<usize, f64>; FIELDS]> = HashMap::new();
        let mut field_lengths = Vec::with_capacity(chunks.len());
        let mut totals = [0.0; FIELDS];
        for (id, chunk) in chunks.iter().enumerate() {
            let fields = [chunk.title.clone(), chunk.heading_path.clone(), chunk.tags.join(" "), strip_markdown(&chunk.text)];
            let mut lengths = [0.0; FIELDS];
            for (f, text) in fields.iter().enumerate() {
                let tokens: Vec<&str> = tokenize(text).collect();
                lengths[f] = tokens.iter().filter(|t| !process_term(t).is_empty()).count() as f64;
                totals[f] += lengths[f];
                for token in tokens {
                    for term in process_term(token) {
                        *postings.entry(term).or_default()[f].entry(id).or_default() += 1.0;
                    }
                }
            }
            field_lengths.push(lengths);
        }
        let n = chunks.len().max(1) as f64;
        Self { postings, field_lengths, avg_lengths: totals.map(|t| t / n) }
    }

    /// OR query: per-document sum of boosted BM25+ scores, with the matched index terms.
    fn search(&self, query: &str) -> Vec<(usize, f64, Vec<String>)> {
        let n = self.field_lengths.len() as f64;
        let mut scores: HashMap<usize, (f64, Vec<String>)> = HashMap::new();
        for token in tokenize(query) {
            for term in process_term(token) {
                let Some(fields) = self.postings.get(&term) else { continue };
                for (f, docs) in fields.iter().enumerate() {
                    let df = docs.len() as f64;
                    if df == 0.0 {
                        continue;
                    }
                    let idf = (1.0 + (n - df + 0.5) / (df + 0.5)).ln();
                    for (&doc, &tf) in docs {
                        let norm = self.field_lengths[doc][f] / self.avg_lengths[f].max(f64::MIN_POSITIVE);
                        let score = BOOSTS[f] * idf * (D + tf * (K + 1.0) / (tf + K * (1.0 - B + B * norm)));
                        let entry = scores.entry(doc).or_default();
                        entry.0 += score;
                        if !entry.1.contains(&term) {
                            entry.1.push(term.clone());
                        }
                    }
                }
            }
        }
        let mut out: Vec<_> = scores.into_iter().map(|(doc, (score, terms))| (doc, score, terms)).collect();
        out.sort_by(|a, b| b.1.total_cmp(&a.1).then(a.0.cmp(&b.0)));
        out
    }
}

pub struct GuideSearch {
    chunks: Vec<GuideChunk>,
    index: KeywordIndex,
}

impl GuideSearch {
    pub fn new(store: &GuideContentStore) -> Self {
        let chunks = chunk_entries(store.all());
        let index = KeywordIndex::build(&chunks);
        Self { chunks, index }
    }

    /// Search results as the guide's search step expects them (`SearchResult[]`).
    pub fn search(&self, query: &str) -> Value {
        let query_terms = tokenize_query(query);
        let scored: Vec<_> = self.index.search(query).into_iter().take(MAX_RESULTS).collect();
        let mut pages: indexmap::IndexMap<&str, Vec<(&GuideChunk, Vec<String>)>> = indexmap::IndexMap::new();
        for (index, _, matched) in &scored {
            let chunk = &self.chunks[*index];
            let terms = if matched.is_empty() { query_terms.clone() } else { matched.clone() };
            pages.entry(chunk.slug.as_str()).or_default().push((chunk, terms));
        }
        let results = pages
            .values()
            .take(MAX_PAGES)
            .map(|sections| {
                let (best, best_terms) = &sections[0];
                let excerpt_terms = if best_terms.is_empty() { &query_terms } else { best_terms };
                let mut seen = HashSet::new();
                let unique: Vec<Value> = sections
                    .iter()
                    .filter(|(c, _)| c.heading != "Introduction")
                    .map(|(c, _)| (c.heading.clone(), format!("{}#{}", c.path, slugify_heading(&c.heading))))
                    .filter(|(_, href)| seen.insert(href.clone()))
                    .take(MAX_SECTIONS_PER_PAGE)
                    .map(|(heading, href)| Value::from_pairs([("heading", Value::from(heading)), ("href", Value::from(href))]))
                    .collect();
                Value::from_pairs([
                    ("slug", Value::from(best.slug.as_str())),
                    ("title", Value::from(best.title.as_str())),
                    ("href", Value::from(best.path.as_str())),
                    ("excerpt", Value::from(build_excerpt(&best.text, excerpt_terms))),
                    ("sections", Value::array(unique)),
                ])
            })
            .collect();
        Value::array(results)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn excerpts_highlight_whole_words() {
        let terms = vec!["forge".to_string()];
        assert_eq!(build_excerpt("Use **Forge** to <b>build</b> forms. Forgery is not.", &terms), "Use <mark>Forge</mark> to build forms. Forgery is not....");
    }

    #[test]
    fn sections_split_on_h2_and_h3() {
        let s = split_into_sections("intro text\n## A\nbody a\n### B\nbody b");
        let paths: Vec<_> = s.iter().map(|s| s.heading_path.as_str()).collect();
        assert_eq!(paths, ["Introduction", "A", "A > B"]);
    }
}
