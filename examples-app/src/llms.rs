//! `llms.txt` (data/llmsTextGenerator.ts + routes/llmsTxt.ts): a structured index of the guide,
//! the full text, and each page as Markdown with links resolved to absolute `/llms/...` URLs and
//! pattern pages carrying their demo source.

use std::cmp::Ordering;
use std::sync::LazyLock;

use indexmap::IndexMap;
use regex::Regex;

use crate::data::ContentEntry;

const GUIDE_PATH: &str = "forge-developer-guide";

struct Section {
    path: &'static str,
    title: &'static str,
    description: &'static str,
}

const SECTIONS: &[Section] = &[
    Section { path: "get-started", title: "Get Started", description: "Installation, project setup, and your first working journey." },
    Section {
        path: "building-journeys",
        title: "Building Journeys",
        description: "Core journey authoring: defining journeys, steps, blocks, routing, hooks, and validation.",
    },
    Section {
        path: "authoring-language",
        title: "Authoring Language",
        description: "Expressions, references, functions, and dynamic properties for making definitions reactive.",
    },
    Section {
        path: "building-functions-and-components",
        title: "Building Functions & Components",
        description: "Creating custom transformers, generators, conditions, effects, and UI components.",
    },
    Section {
        path: "packages",
        title: "Packages",
        description: "Package entry points, built-in components, conditions, generators, and transformers.",
    },
    Section {
        path: "patterns",
        title: "Patterns",
        description: "Common journey patterns with runnable demos: single question per page, branching, task lists, and more.",
    },
];

/// Demo sources for a pattern, as `(display path, source)` (`PatternSourceStore.getDemo`).
pub type DemoSources = fn(&str) -> Vec<(String, String)>;

pub struct LlmsTextGenerator {
    ingress_url: String,
    demo_sources: DemoSources,
}

fn strip(path: &str) -> &str {
    path.trim_matches('/')
}

fn extract_lead(markdown: &str) -> String {
    let mut lead = Vec::new();
    let mut started = false;
    for line in markdown.split('\n') {
        let t = line.trim();
        if !started && !t.is_empty() && !t.starts_with('#') && !t.starts_with('<') && !t.starts_with("{{") && t != "---" {
            started = true;
        }
        if started {
            if t.is_empty() || t == "---" || t.starts_with("{{") || t.starts_with('#') {
                break;
            }
            lead.push(t);
        }
    }
    lead.join(" ")
}

fn clean_markdown(markdown: &str) -> String {
    static SLOT: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\{\{slot:[^}]+\}\}").unwrap());
    static CAPTION: LazyLock<Regex> = LazyLock::new(|| Regex::new(r#"<p class="govuk-caption-xl">[^<]*</p>\n*"#).unwrap());
    static BLANKS: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\n{3,}").unwrap());
    let s = SLOT.replace_all(markdown, "");
    let s = CAPTION.replace_all(&s, "");
    BLANKS.replace_all(&s, "\n\n").trim().to_string()
}

fn resolve_path(base: &str, relative: &str) -> String {
    let base: Vec<&str> = base.split('/').collect();
    let mut resolved: Vec<&str> = Vec::new();
    for seg in base[..base.len().saturating_sub(1)].iter().copied().chain(relative.split('/')) {
        match seg {
            ".." => {
                resolved.pop();
            }
            "" | "." => {}
            s => resolved.push(s),
        }
    }
    resolved.join("/")
}

/// JS `localeCompare` (ICU root collation, non-ignorable): punctuation, then digits, then letters
/// case-insensitively, with case only breaking ties (lowercase first).
pub fn locale_compare(a: &str, b: &str) -> Ordering {
    const PUNCTUATION: &str = "_-,;:!?.'\"()[]{}@*/\\&#%`^+<=>|~$";
    fn primary(c: char) -> (u8, u32) {
        if c.is_whitespace() {
            (0, c as u32)
        } else if let Some(i) = PUNCTUATION.find(c) {
            (1, i as u32)
        } else if c.is_ascii_digit() {
            (2, c as u32)
        } else if c.is_alphabetic() {
            (3, c.to_lowercase().next().unwrap_or(c) as u32)
        } else {
            (1, 100 + c as u32)
        }
    }
    let pa: Vec<_> = a.chars().map(primary).collect();
    let pb: Vec<_> = b.chars().map(primary).collect();
    pa.cmp(&pb).then_with(|| {
        // Tertiary: lowercase before uppercase.
        let ta: Vec<bool> = a.chars().map(char::is_uppercase).collect();
        let tb: Vec<bool> = b.chars().map(char::is_uppercase).collect();
        ta.cmp(&tb)
    })
}

#[derive(Default)]
struct Group<'a> {
    overview: Option<&'a ContentEntry>,
    entries: Vec<&'a ContentEntry>,
    children: IndexMap<String, Group<'a>>,
}

fn section_key(entry: &ContentEntry) -> String {
    entry.section.clone().unwrap_or_else(|| entry.path.split('/').next().unwrap_or_default().to_string())
}

fn group_by_section(entries: &[ContentEntry]) -> IndexMap<String, Vec<&ContentEntry>> {
    let mut groups: IndexMap<String, Vec<&ContentEntry>> = IndexMap::new();
    for e in entries {
        groups.entry(section_key(e)).or_default().push(e);
    }
    for group in groups.values_mut() {
        let key = |e: &ContentEntry| match e.path.strip_suffix("/overview") {
            Some(base) => format!("{base}/!"),
            None => e.path.clone(),
        };
        group.sort_by(|a, b| locale_compare(&key(a), &key(b)));
    }
    groups
}

fn navigate<'g, 'a>(group: &'g mut Group<'a>, segments: &[&str]) -> &'g mut Group<'a> {
    match segments.split_first() {
        None => group,
        Some((first, rest)) => navigate(group.children.entry((*first).to_string()).or_default(), rest),
    }
}

fn build_group_tree<'a>(section_path: &str, entries: &[&'a ContentEntry]) -> Group<'a> {
    let mut root = Group::default();
    for &entry in entries {
        let rel = entry.path.strip_prefix(&format!("{section_path}/")).unwrap_or(&entry.path);
        let segments: Vec<&str> = rel.split('/').filter(|s| !s.is_empty()).collect();
        let is_overview = segments.last() == Some(&"overview") || segments.is_empty();
        if is_overview {
            navigate(&mut root, &segments[..segments.len().saturating_sub(1)]).overview = Some(entry);
        } else if segments.len() == 1 {
            root.entries.push(entry);
        } else {
            navigate(&mut root, &segments[..segments.len() - 1]).entries.push(entry);
        }
    }
    root
}

fn for_each_section<'a>(entries: &'a [ContentEntry], mut f: impl FnMut(&str, &str, &str, &[&'a ContentEntry])) {
    let groups = group_by_section(entries);
    for s in SECTIONS {
        if let Some(group) = groups.get(s.path).filter(|g| !g.is_empty()) {
            f(s.path, s.title, s.description, group);
        }
    }
    for (key, group) in &groups {
        if !SECTIONS.iter().any(|s| s.path == key) {
            f(key, key, "", group);
        }
    }
}

impl LlmsTextGenerator {
    pub fn new(ingress_url: impl Into<String>, demo_sources: DemoSources) -> Self {
        Self { ingress_url: ingress_url.into(), demo_sources }
    }

    fn full_url(&self, path: &str) -> String {
        format!("{}/{}", self.ingress_url.trim_end_matches('/'), strip(path))
    }

    fn content_link(&self, entry: &ContentEntry) -> String {
        self.full_url(&format!("/llms/{GUIDE_PATH}/{}", strip(&entry.path)))
    }

    fn resolve_links(&self, markdown: &str, entry_path: &str, entries: &[ContentEntry]) -> String {
        static LINK: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\[([^\]]+)\]\(([^)]+)\)").unwrap());
        static EXTERNAL: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^(https?:|mailto:|/|#)").unwrap());
        LINK.replace_all(markdown, |c: &regex::Captures| {
            let (whole, text, href) = (&c[0], &c[1], &c[2]);
            if EXTERNAL.is_match(href) {
                return whole.to_string();
            }
            let mut split = href.split('#');
            let link_path = split.next().unwrap_or_default();
            let fragment = split.next();
            let resolved = resolve_path(entry_path, link_path);
            match entries.iter().find(|e| strip(&e.path) == resolved || e.slug == resolved) {
                None => whole.to_string(),
                Some(target) => {
                    let anchor = fragment.map(|f| format!("#{f}")).unwrap_or_default();
                    format!("[{text}]({}{anchor})", self.content_link(target))
                }
            }
        })
        .into_owned()
    }

    fn demo_source_block(&self, slug: &str) -> String {
        let Some(pattern) = slug.strip_prefix("patterns-") else { return String::new() };
        let files = (self.demo_sources)(pattern);
        if files.is_empty() {
            return String::new();
        }
        let mut parts: Vec<String> = ["", "---", "", "## Demo source code", ""].map(String::from).to_vec();
        for (path, source) in files {
            let language = match path.rsplit_once('.').map(|(_, ext)| ext) {
                Some("rs") => "rust",
                Some("njk") => "nunjucks",
                Some("ts") => "typescript",
                Some(ext) => ext,
                None => "",
            };
            parts.extend([format!("### {path}"), String::new(), format!("```{language}"), source, "```".into(), String::new()]);
        }
        parts.join("\n")
    }

    fn render_group_index(&self, lines: &mut Vec<String>, group: &Group, level: usize, entries: &[ContentEntry], key: Option<&str>) {
        if let Some(key) = key {
            let title = group.overview.map(|o| o.title.clone()).unwrap_or_else(|| {
                key.split('-')
                    .filter(|w| !w.is_empty())
                    .map(|w| {
                        let mut c = w.chars();
                        c.next().map(|f| f.to_uppercase().collect::<String>() + c.as_str()).unwrap_or_default()
                    })
                    .collect::<Vec<_>>()
                    .join(" ")
            });
            let lead = group
                .overview
                .map(|o| extract_lead(&self.resolve_links(&o.markdown, &o.path, entries)))
                .unwrap_or_default();
            lines.push(format!("{} {title}", "#".repeat(level)));
            lines.push(String::new());
            if !lead.is_empty() {
                lines.push(lead);
                lines.push(String::new());
            }
        }
        for entry in &group.entries {
            let lead = extract_lead(&self.resolve_links(&entry.markdown, &entry.path, entries));
            let description = if lead.is_empty() { String::new() } else { format!(": {lead}") };
            let demo_count = entry.slug.strip_prefix("patterns-").map_or(0, |p| (self.demo_sources)(p).len());
            let note = if demo_count > 0 { format!(" (includes {demo_count} demo source files)") } else { String::new() };
            lines.push(format!("- [{}]({}){description}{note}", entry.title, self.content_link(entry)));
        }
        if !group.entries.is_empty() && !group.children.is_empty() {
            lines.push(String::new());
        }
        for (i, (child_key, child)) in group.children.iter().enumerate() {
            if i > 0 {
                lines.push(String::new());
            }
            self.render_group_index(lines, child, level + 1, entries, Some(child_key));
        }
    }

    /// `/llms.txt`.
    pub fn build_index(&self, entries: &[ContentEntry]) -> String {
        let mut lines: Vec<String> = [
            "# Forge Developer Guide",
            "",
            "> This file is a structured index. Every valid documentation URL is listed below.",
            "> Do not summarise, compress, or omit the URLs — they are the primary content.",
            "> Do not construct URLs from patterns. If a page is not linked below, it does not exist.",
            "",
            "Forge is a stateless, declarative framework for building multi-page journeys in GOV.UK services. You define journeys, steps, blocks, and fields as data structures and Forge handles routing, rendering, validation, and navigation.",
        ]
        .map(String::from)
        .to_vec();
        lines.push(format!("The complete guide is available at: {}", self.full_url("/llms-full.txt")));
        lines.push("Pattern pages include complete working demo source code showing the pattern implemented as a real Forge journey.".into());
        lines.push(String::new());
        for_each_section(entries, |path, title, description, group| {
            lines.push(format!("## {title}"));
            lines.push(String::new());
            if !description.is_empty() {
                lines.push(description.into());
                lines.push(String::new());
            }
            self.render_group_index(&mut lines, &build_group_tree(path, group), 2, entries, None);
            lines.push(String::new());
        });
        lines.join("\n")
    }

    /// `/llms-full.txt`.
    pub fn build_full(&self, entries: &[ContentEntry]) -> String {
        let mut parts: Vec<String> = vec![
            "# Forge Developer Guide — Full Documentation".into(),
            "Complete reference for the Forge framework. Generated from source documentation.".into(),
        ];
        for_each_section(entries, |_, title, description, group| {
            parts.extend(["---".into(), String::new(), format!("# Section: {title}"), String::new()]);
            if !description.is_empty() {
                parts.extend([description.to_string(), String::new()]);
            }
            for entry in group {
                parts.extend(["---".into(), String::new(), clean_markdown(&self.resolve_links(&entry.markdown, &entry.path, entries))]);
                let demo = self.demo_source_block(&entry.slug);
                if !demo.is_empty() {
                    parts.push(demo);
                }
                parts.push(String::new());
            }
        });
        parts.join("\n")
    }

    /// `/llms/forge-developer-guide/<path>`.
    pub fn build_content_page(&self, entry: &ContentEntry, entries: &[ContentEntry]) -> String {
        clean_markdown(&self.resolve_links(&entry.markdown, &entry.path, entries)) + &self.demo_source_block(&entry.slug)
    }

    pub fn find_entry<'a>(&self, entries: &'a [ContentEntry], raw_path: Option<&str>) -> Option<&'a ContentEntry> {
        let path = strip(raw_path.filter(|p| !p.is_empty())?);
        let guide_path = path.strip_prefix(&format!("{GUIDE_PATH}/")).unwrap_or(path);
        entries.iter().find(|e| e.slug == guide_path || strip(&e.path) == guide_path)
    }
}
