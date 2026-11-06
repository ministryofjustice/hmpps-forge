//! `govukMarkdown` (components/govukMarkdown.ts): CommonMark with GOV.UK classes, rendered the
//! way markdown-it does (with `html: true`, `linkify: true`, tables and strikethrough). The
//! parser is pulldown-cmark. The HTML writer here is its own, mirroring markdown-it's output and
//! the TS renderer-rule overrides.

use std::sync::LazyLock;

use pulldown_cmark::{Alignment, CodeBlockKind, Event, HeadingLevel, Options, Parser, Tag, TagEnd};
use regex::Regex;

use crate::data::slugify_heading;
use crate::highlight;

fn escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            c => out.push(c),
        }
    }
    out
}

/// markdown-it's `escapeHtml` + `normalizeLink` for attribute URLs.
fn escape_href(s: &str) -> String {
    let mut out = String::new();
    for c in s.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '"' => out.push_str("&quot;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            c if c.is_ascii_alphanumeric() || "-_.!~*'();/?:@=+$,#%".contains(c) => out.push(c),
            c => {
                let mut buf = [0; 4];
                for b in c.encode_utf8(&mut buf).bytes() {
                    out.push_str(&format!("%{b:02X}"));
                }
            }
        }
    }
    out
}

fn heading_size(level: HeadingLevel) -> &'static str {
    match level {
        HeadingLevel::H1 => "xl",
        HeadingLevel::H2 => "l",
        HeadingLevel::H3 => "m",
        _ => "s",
    }
}

/// linkify-it (markdown-it's `linkify`): `http(s)://` and `mailto:` links, plus fuzzy links
/// (bare hosts ending in a known TLD, such as `GOV.UK`) and fuzzy emails.
static LINKIFY: LazyLock<Regex> = LazyLock::new(|| {
    const TLDS: &str = "biz|com|edu|gov|net|org|pro|web|xxx|aero|asia|coop|info|museum|name|shop|рф|a[cdefgilmnoqrstuwxz]|b[abdefghijmnorstvwyz]|c[acdfghiklmnoruvwxyz]|d[ejkmoz]|e[cegrstu]|f[ijkmor]|g[abdefghilmnpqrstuwy]|h[kmnrtu]|i[delmnoqrst]|j[emop]|k[eghimnprwyz]|l[abcikrstuvy]|m[acdeghklmnopqrstuvwxyz]|n[acefgilopruz]|om|p[aefghklmnrstwy]|qa|r[eosuw]|s[abcdeghijklmnortuvxyz]|t[cdfghjklmnortvwz]|u[agksyz]|v[aceginu]|w[fs]|y[et]|z[amw]";
    let path = r#"(?:[/?#][^\s<>"']*[^\s<>"'.,;:!?)\]])?"#;
    Regex::new(&format!(
        r#"(?i)(?P<schema>(?:https?|ftp)://[^\s<>"']*[^\s<>"'.,;:!?)\]]|mailto:[^\s<>"']+[^\s<>"'.,;:!?)\]])|(?P<email>[\w.+-]+@(?:[\p{{L}}\p{{N}}](?:[\p{{L}}\p{{N}}-]*[\p{{L}}\p{{N}}])?\.)+(?:{TLDS}))|(?P<host>(?:[\p{{L}}\p{{N}}](?:[\p{{L}}\p{{N}}-]*[\p{{L}}\p{{N}}])?\.)+(?:{TLDS})(?::\d{{2,5}})?{path})"#
    ))
    .unwrap()
});

/// A fuzzy match must stand alone: not glued to a preceding word, dot, slash or `@`, and the TLD
/// must end the host label.
fn fuzzy_boundary_ok(text: &str, start: usize, host_end: usize) -> bool {
    let before = text[..start].chars().next_back();
    let after = text[host_end..].chars().next();
    before.is_none_or(|c| !(c.is_alphanumeric() || ".:/-_@".contains(c)))
        && after.is_none_or(|c| !(c.is_alphanumeric() || c == '-' || c == '_'))
}

struct Writer {
    out: String,
    table_alignments: Vec<Alignment>,
    table_cell: usize,
    in_table_head: bool,
    link_depth: usize,
    image_alt: Option<String>,
    image: Option<(String, String)>,
}

impl Writer {
    fn ends_newline(&self) -> bool {
        self.out.is_empty() || self.out.ends_with('\n')
    }

    fn block(&mut self, s: &str) {
        if !self.ends_newline() {
            self.out.push('\n');
        }
        self.out.push_str(s);
    }

    fn text(&mut self, t: &str) {
        if let Some(alt) = &mut self.image_alt {
            alt.push_str(t);
            return;
        }
        if self.link_depth > 0 {
            self.out.push_str(&escape(t));
            return;
        }
        let mut last = 0;
        for c in LINKIFY.captures_iter(t) {
            let m = c.get(0).unwrap();
            let url = m.as_str();
            let href = if c.name("schema").is_some() {
                url.to_string()
            } else if c.name("email").is_some() {
                if !fuzzy_boundary_ok(t, m.start(), m.end()) {
                    continue;
                }
                format!("mailto:{url}")
            } else {
                let host_end = m.start() + url.find(['/', '?', '#', ':']).unwrap_or(url.len());
                if !fuzzy_boundary_ok(t, m.start(), host_end) {
                    continue;
                }
                format!("http://{url}")
            };
            self.out.push_str(&escape(&t[last..m.start()]));
            self.out.push_str(&format!("<a href=\"{}\" class=\"govuk-link\">{}</a>", escape_href(&href), escape(url)));
            last = m.end();
        }
        self.out.push_str(&escape(&t[last..]));
    }
}

fn render_events<'a>(events: Vec<Event<'a>>) -> String {
    let mut w = Writer { out: String::new(), table_alignments: vec![], table_cell: 0, in_table_head: false, link_depth: 0, image_alt: None, image: None };
    let mut i = 0;
    while i < events.len() {
        match &events[i] {
            Event::Start(Tag::Heading { level, id, classes, .. }) => {
                let mut text = String::new();
                let mut j = i + 1;
                while !matches!(events[j], Event::End(TagEnd::Heading(_))) {
                    if let Event::Text(t) | Event::Code(t) = &events[j] {
                        text.push_str(t);
                    }
                    j += 1;
                }
                let size = heading_size(*level);
                let class = merge_classes(&format!("govuk-heading-{size}"), classes.iter().map(|c| c.as_ref()).collect::<Vec<_>>().join(" "));
                let id = match id {
                    Some(id) => Some(id.to_string()),
                    None if !text.is_empty() => Some(slugify_heading(&text)),
                    None => None,
                };
                let id_attr = id.map(|id| format!(" id=\"{}\"", escape(&id))).unwrap_or_default();
                w.block(&format!("<{level} class=\"{class}\"{id_attr}>"));
            }
            Event::End(TagEnd::Heading(level)) => w.out.push_str(&format!("</{level}>\n")),
            Event::Start(Tag::Paragraph) => w.block("<p class=\"govuk-body\">"),
            Event::End(TagEnd::Paragraph) => w.out.push_str("</p>\n"),
            Event::Start(Tag::BlockQuote(_)) => w.block("<div class=\"govuk-inset-text\">\n"),
            Event::End(TagEnd::BlockQuote(_)) => w.block("</div>\n"),
            Event::Start(Tag::List(None)) => w.block("<ul class=\"govuk-list govuk-list--bullet\">\n"),
            Event::Start(Tag::List(Some(1))) => w.block("<ol class=\"govuk-list govuk-list--number\">\n"),
            Event::Start(Tag::List(Some(n))) => w.block(&format!("<ol start=\"{n}\" class=\"govuk-list govuk-list--number\">\n")),
            Event::End(TagEnd::List(ordered)) => w.block(if *ordered { "</ol>\n" } else { "</ul>\n" }),
            Event::Start(Tag::Item) => w.block("<li>"),
            Event::End(TagEnd::Item) => w.out.push_str("</li>\n"),
            Event::Start(Tag::CodeBlock(kind)) => {
                let lang = match kind {
                    CodeBlockKind::Fenced(info) => info.split_whitespace().next().unwrap_or("").to_string(),
                    CodeBlockKind::Indented => String::new(),
                };
                let mut code = String::new();
                i += 1;
                while !matches!(events[i], Event::End(TagEnd::CodeBlock)) {
                    if let Event::Text(t) = &events[i] {
                        code.push_str(t);
                    }
                    i += 1;
                }
                let html = match highlight::highlight(&code, &lang) {
                    Some(h) => format!("<pre><code class=\"hljs language-{lang}\">{h}</code></pre>\n"),
                    None if lang.is_empty() => format!("<pre><code>{}</code></pre>\n", escape(&code)),
                    None => format!("<pre><code class=\"language-{}\">{}</code></pre>\n", escape(&lang), escape(&code)),
                };
                w.block(&html);
            }
            Event::Start(Tag::Table(alignments)) => {
                w.table_alignments = alignments.clone();
                w.block("<table class=\"govuk-table\">\n");
            }
            Event::End(TagEnd::Table) => {
                if !w.in_table_head && w.out.ends_with("</thead>\n") {
                    // markdown-it omits an empty tbody.
                } else {
                    w.out.push_str("</tbody>\n");
                }
                w.out.push_str("</table>\n");
            }
            Event::Start(Tag::TableHead) => {
                w.in_table_head = true;
                w.table_cell = 0;
                w.out.push_str("<thead class=\"govuk-table__head\">\n<tr class=\"govuk-table__row\">\n");
            }
            Event::End(TagEnd::TableHead) => {
                w.in_table_head = false;
                w.out.push_str("</tr>\n</thead>\n");
                // Open the body lazily, when the first body row starts.
            }
            Event::Start(Tag::TableRow) => {
                w.table_cell = 0;
                if w.out.ends_with("</thead>\n") {
                    w.out.push_str("<tbody class=\"govuk-table__body\">\n");
                }
                w.out.push_str("<tr class=\"govuk-table__row\">\n");
            }
            Event::End(TagEnd::TableRow) => w.out.push_str("</tr>\n"),
            Event::Start(Tag::TableCell) => {
                let style = match w.table_alignments.get(w.table_cell) {
                    Some(Alignment::Left) => " style=\"text-align:left\"",
                    Some(Alignment::Center) => " style=\"text-align:center\"",
                    Some(Alignment::Right) => " style=\"text-align:right\"",
                    _ => "",
                };
                if w.in_table_head {
                    w.out.push_str(&format!("<th scope=\"col\" class=\"govuk-table__header\"{style}>"));
                } else {
                    w.out.push_str(&format!("<td class=\"govuk-table__cell\"{style}>"));
                }
            }
            Event::End(TagEnd::TableCell) => {
                w.out.push_str(if w.in_table_head { "</th>\n" } else { "</td>\n" });
                w.table_cell += 1;
            }
            Event::Start(Tag::Emphasis) => w.out.push_str("<em>"),
            Event::End(TagEnd::Emphasis) => w.out.push_str("</em>"),
            Event::Start(Tag::Strong) => w.out.push_str("<strong>"),
            Event::End(TagEnd::Strong) => w.out.push_str("</strong>"),
            Event::Start(Tag::Strikethrough) => w.out.push_str("<s>"),
            Event::End(TagEnd::Strikethrough) => w.out.push_str("</s>"),
            Event::Start(Tag::Link { dest_url, title, .. }) => {
                let title = if title.is_empty() { String::new() } else { format!(" title=\"{}\"", escape(title)) };
                w.out.push_str(&format!("<a href=\"{}\"{title} class=\"govuk-link\">", escape_href(dest_url)));
                w.link_depth += 1;
            }
            Event::End(TagEnd::Link) => {
                w.link_depth -= 1;
                w.out.push_str("</a>");
            }
            Event::Start(Tag::Image { dest_url, title, .. }) => {
                let title = if title.is_empty() { String::new() } else { format!(" title=\"{}\"", escape(title)) };
                w.image = Some((escape_href(dest_url), title));
                w.image_alt = Some(String::new());
            }
            Event::End(TagEnd::Image) => {
                let alt = w.image_alt.take().unwrap_or_default();
                let (src, title) = w.image.take().unwrap_or_default();
                w.out.push_str(&format!("<img src=\"{src}\" alt=\"{}\"{title}>", escape(&alt)));
            }
            Event::Text(t) => w.text(t),
            Event::Code(t) => {
                if let Some(alt) = &mut w.image_alt {
                    alt.push_str(t);
                } else {
                    w.out.push_str(&format!("<code>{}</code>", escape(t)));
                }
            }
            Event::Html(h) => w.out.push_str(h),
            Event::InlineHtml(h) => w.out.push_str(h),
            Event::SoftBreak => w.out.push('\n'),
            Event::HardBreak => w.out.push_str("<br>\n"),
            Event::Rule => w.block("<hr class=\"govuk-section-break govuk-section-break--l govuk-section-break--visible\">\n"),
            _ => {}
        }
        i += 1;
    }
    w.out
}

/// `mergeClasses`.
fn merge_classes(govuk: &str, existing: String) -> String {
    if existing.is_empty() {
        govuk.into()
    } else if existing.contains("lead") {
        existing.replacen("lead", "govuk-body-l", 1)
    } else {
        format!("{govuk} {existing}")
    }
}

pub fn render_markdown(markdown: &str) -> String {
    let options = Options::ENABLE_TABLES | Options::ENABLE_STRIKETHROUGH;
    render_events(Parser::new_ext(markdown.trim(), options).collect())
}

static SLOT_MARKER: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\{\{slot:([^}]+)\}\}").unwrap());
static SLOT_PLACEHOLDER: LazyLock<Regex> = LazyLock::new(|| Regex::new(r#"<div data-forge-slot="([^"]+)"></div>"#).unwrap());

/// The component: Markdown with `{{slot:name}}` markers replaced by rendered child blocks.
pub fn govuk_markdown(content: &str, slots: Option<&dyn Fn(&str) -> Option<String>>) -> String {
    if content.is_empty() {
        return String::new();
    }
    let Some(slots) = slots else { return render_markdown(content) };
    let marked = SLOT_MARKER.replace_all(content, r#"<div data-forge-slot="$1"></div>"#);
    let html = render_markdown(&marked);
    SLOT_PLACEHOLDER.replace_all(&html, |c: &regex::Captures| slots(&c[1]).unwrap_or_default()).into_owned()
}
