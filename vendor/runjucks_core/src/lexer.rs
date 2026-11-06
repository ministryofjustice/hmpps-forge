//! Tokenization: splits template source into [`Token`]s for [`crate::parser::parse`].
//!
//! Recognized regions:
//! - `{#` … `#}` — comments (omitted from output).
//! - `{%` / `{%-` … `%}` / `-%}` — statement tags as [`Token::Tag`] (inner body is whitespace-trimmed).
//! - `{{` / `{{-` … `}}` / `-}}` — expressions as [`Token::Expression`] (inner spaces preserved unless trim markers strip them).
//!
//! **Whitespace control (Nunjucks-style):** `{%-` / `{{-` strip trailing whitespace from the preceding
//! [`Token::Text`]; `-%}` / `-}}` strip leading whitespace from the following `Text`. Tag/variable
//! bodies still trim inner whitespace when those markers are present (see variable handling below).
//!
//! Closing delimiters `%}` / `}}` are detected outside of double-quoted string literals (with `\`
//! escapes), so delimiter-like sequences inside strings do not end the region early.
//!
//! `{% raw %}…{% endraw %}` and `{% verbatim %}…{% endverbatim %}` treat the middle as literal [`Token::Text`].

use crate::errors::{Result, RunjucksError};

/// Nunjucks-style delimiter customization (the `tags` key in `configure`).
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Tags {
    pub block_start: String,
    pub block_end: String,
    pub variable_start: String,
    pub variable_end: String,
    pub comment_start: String,
    pub comment_end: String,
}

impl Default for Tags {
    fn default() -> Self {
        Self {
            block_start: "{%".into(),
            block_end: "%}".into(),
            variable_start: "{{".into(),
            variable_end: "}}".into(),
            comment_start: "{#".into(),
            comment_end: "#}".into(),
        }
    }
}

/// Options controlling whitespace behavior and delimiters during lexing.
///
/// Mirrors the Nunjucks `trimBlocks`, `lstripBlocks`, and `tags` configuration keys.
#[derive(Clone, Debug, Default)]
pub struct LexerOptions {
    /// When `true`, the first newline after a `{% … %}` tag is stripped.
    pub trim_blocks: bool,
    /// When `true`, leading whitespace and tabs on a line are stripped up to a `{% … %}` tag or `{# … #}` comment
    /// (only when the tag/comment is the first non-whitespace on that line).
    pub lstrip_blocks: bool,
    /// Custom delimiter strings. `None` uses the Nunjucks defaults (`{%`, `%}`, `{{`, `}}`, `{#`, `#}`).
    pub tags: Option<Tags>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum OpenKind {
    Comment { trim_open: bool },
    Tag { trim_open: bool },
    Var { trim_open: bool },
}

fn next_opener(rest: &str, tags: &Tags) -> Option<(usize, OpenKind)> {
    let bs = &tags.block_start;
    let vs = &tags.variable_start;
    let cs = &tags.comment_start;
    let bs_trim = format!("{bs}-");
    let cs_trim = format!("{cs}-");

    let vs_trim = format!("{vs}-");

    let mut best: Option<(usize, OpenKind)> = None;
    for (i, _) in rest.char_indices() {
        let s = &rest[i..];
        let candidate = if s.starts_with(cs_trim.as_str()) {
            Some((i, OpenKind::Comment { trim_open: true }))
        } else if s.starts_with(cs.as_str()) {
            Some((i, OpenKind::Comment { trim_open: false }))
        } else if s.starts_with(bs_trim.as_str()) {
            Some((i, OpenKind::Tag { trim_open: true }))
        } else if s.starts_with(bs.as_str()) {
            Some((i, OpenKind::Tag { trim_open: false }))
        } else if s.starts_with(vs_trim.as_str()) {
            Some((i, OpenKind::Var { trim_open: true }))
        } else if s.starts_with(vs.as_str()) {
            Some((i, OpenKind::Var { trim_open: false }))
        } else {
            None
        };
        if let Some((idx, kind)) = candidate {
            best = match best {
                None => Some((idx, kind)),
                Some((bi, _)) if idx < bi => Some((idx, kind)),
                Some(b) => Some(b),
            };
        }
    }
    best
}

fn parse_tag_prefix(rest: &str, tags: &Tags) -> Result<(String, usize, bool)> {
    let bs = &tags.block_start;
    let bs_trim = format!("{bs}-");
    let open_len = if rest.starts_with(bs_trim.as_str()) {
        bs_trim.len()
    } else if rest.starts_with(bs.as_str()) {
        bs.len()
    } else {
        return Err(RunjucksError::new(format!(
            "internal lexer error: expected `{bs}`"
        )));
    };
    let after_open = &rest[open_len..];
    let (body_end, close_len) = find_tag_close(after_open, &tags.block_end)?;
    let trim_close_marker = format!("-{}", tags.block_end);
    let trim_close = after_open[body_end..].starts_with(trim_close_marker.as_str());
    let body = after_open[..body_end].trim().to_string();
    let total = open_len + body_end + close_len;
    Ok((body, total, trim_close))
}

/// Finds the byte index of the `{%` that starts the **matching** closing tag, balancing nested
/// `{% raw %}` / `{% endraw %}` (or `verbatim` / `endverbatim`) like Nunjucks `parseRaw`.
///
/// `rest` is the template suffix **after** the opening `{% raw %}` / `{% verbatim %}` tag was consumed.
/// Nesting level starts at 1 (inside the outer block).
fn find_matching_block_close(
    rest: &str,
    open_name: &str,
    end_name: &str,
    tags: &Tags,
) -> Result<usize> {
    let bs = &tags.block_start;
    let bs_trim = format!("{bs}-");
    let open_prefix = format!("{open_name} ");
    let end_prefix = format!("{end_name} ");
    let mut pos = 0usize;
    let mut level = 1usize;
    while pos < rest.len() {
        let slice = &rest[pos..];
        if !slice.starts_with(bs.as_str()) && !slice.starts_with(bs_trim.as_str()) {
            let adv = slice.chars().next().map(|c| c.len_utf8()).unwrap_or(1);
            pos += adv;
            continue;
        }
        let tag_start = pos;
        let (body, total, _) = match parse_tag_prefix(slice, tags) {
            Ok(t) => t,
            Err(_) => {
                pos += slice.chars().next().map(|c| c.len_utf8()).unwrap_or(1);
                continue;
            }
        };
        if body.contains(bs.as_str()) {
            pos += slice.chars().next().map(|c| c.len_utf8()).unwrap_or(1);
            continue;
        }
        let is_open = body == open_name || body.starts_with(&open_prefix);
        let is_close = body == end_name || body.starts_with(&end_prefix);
        if is_open {
            level += 1;
        } else if is_close {
            level = level.saturating_sub(1);
            if level == 0 {
                return Ok(tag_start);
            }
        }
        pos = tag_start + total;
    }
    Err(RunjucksError::new(format!(
        "unclosed {end_name} block: expected matching `{}` tag",
        tags.block_end
    )))
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum StringScan {
    Code,
    String,
    StringEscape,
}

fn find_var_close(after_open: &str, tags: &Tags) -> Result<(usize, usize)> {
    let ve = &tags.variable_end;
    let vs = &tags.variable_start;
    let trim_close = format!("-{ve}");
    let mut state = StringScan::Code;
    let mut i = 0usize;
    while i < after_open.len() {
        match state {
            StringScan::StringEscape => {
                let c = after_open[i..].chars().next().unwrap();
                state = StringScan::String;
                i += c.len_utf8();
            }
            StringScan::String => {
                let rest = &after_open[i..];
                let c = rest.chars().next().unwrap();
                if c == '\\' {
                    state = StringScan::StringEscape;
                } else if c == '"' {
                    state = StringScan::Code;
                }
                i += c.len_utf8();
            }
            StringScan::Code => {
                let rest = &after_open[i..];
                if rest.starts_with(trim_close.as_str()) {
                    return Ok((i, trim_close.len()));
                }
                if rest.starts_with(ve.as_str()) {
                    return Ok((i, ve.len()));
                }
                if rest.starts_with(vs.as_str()) {
                    return Err(RunjucksError::new(format!(
                        "nested `{vs}` inside a variable expression is not allowed"
                    )));
                }
                if rest.starts_with('"') {
                    state = StringScan::String;
                    i += 1;
                    continue;
                }
                let c = rest.chars().next().unwrap();
                i += c.len_utf8();
            }
        }
    }
    Err(RunjucksError::new(format!(
        "unclosed variable tag: expected `{ve}` or `-{ve}` after `{vs}`"
    )))
}

fn find_tag_close(after_open: &str, block_end: &str) -> Result<(usize, usize)> {
    let trim_close = format!("-{block_end}");
    let mut state = StringScan::Code;
    let mut i = 0usize;
    while i < after_open.len() {
        match state {
            StringScan::StringEscape => {
                let c = after_open[i..].chars().next().unwrap();
                state = StringScan::String;
                i += c.len_utf8();
            }
            StringScan::String => {
                let rest = &after_open[i..];
                let c = rest.chars().next().unwrap();
                if c == '\\' {
                    state = StringScan::StringEscape;
                } else if c == '"' {
                    state = StringScan::Code;
                }
                i += c.len_utf8();
            }
            StringScan::Code => {
                let rest = &after_open[i..];
                if rest.starts_with(trim_close.as_str()) {
                    return Ok((i, trim_close.len()));
                }
                if rest.starts_with(block_end) {
                    return Ok((i, block_end.len()));
                }
                if rest.starts_with('"') {
                    state = StringScan::String;
                    i += 1;
                    continue;
                }
                let c = rest.chars().next().unwrap();
                i += c.len_utf8();
            }
        }
    }
    Err(RunjucksError::new(format!(
        "unclosed template tag: expected `{block_end}` or `-{block_end}` after block start"
    )))
}

fn apply_var_trim(body: &str, trim_open: bool, trim_close: bool) -> String {
    let mut s = body;
    if trim_open {
        s = s.trim_start();
    }
    if trim_close {
        s = s.trim_end();
    }
    s.to_string()
}

/// One lexical unit from a template.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Token {
    Text(String),
    Expression(String),
    Tag(String),
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum LexerMode {
    Normal,
    Raw,
    Verbatim,
}

/// Incremental lexer over a template string.
#[derive(Debug, Clone)]
pub struct Lexer<'a> {
    input: &'a str,
    position: usize,
    mode: LexerMode,
    pending: Option<Token>,
    /// After `-%}` or `-}}`, strip leading whitespace from the next [`Token::Text`].
    strip_leading_next_text: bool,
    opts: LexerOptions,
    tags: Tags,
    /// After a `{% … %}` tag when `trim_blocks` is on, strip the first newline from the next text.
    trim_block_newline: bool,
}

impl<'a> Lexer<'a> {
    pub fn new(input: &'a str) -> Self {
        Self::with_options(input, LexerOptions::default())
    }

    pub fn with_options(input: &'a str, opts: LexerOptions) -> Self {
        let tags = opts.tags.clone().unwrap_or_default();
        Self {
            input,
            position: 0,
            mode: LexerMode::Normal,
            pending: None,
            strip_leading_next_text: false,
            opts,
            tags,
            trim_block_newline: false,
        }
    }

    #[inline]
    pub fn rest(&self) -> &'a str {
        self.input.get(self.position..).unwrap_or("")
    }

    #[inline]
    pub fn is_eof(&self) -> bool {
        self.position >= self.input.len()
    }

    fn skip_comment(&mut self) -> Result<()> {
        let cs = &self.tags.comment_start;
        let ce = &self.tags.comment_end;
        let rest = self.rest();
        if !rest.starts_with(cs.as_str()) {
            return Err(RunjucksError::new(format!(
                "internal lexer error: expected `{cs}`"
            )));
        }
        let Some(end_rel) = rest.find(ce.as_str()) else {
            return Err(RunjucksError::new(format!(
                "unclosed comment: expected `{ce}` after `{cs}`"
            )));
        };
        // `-#}` strips whitespace from the start of the following text, like `-%}`.
        if end_rel > cs.len() && rest[..end_rel].ends_with('-') {
            self.strip_leading_next_text = true;
        }
        self.position += end_rel + ce.len();
        Ok(())
    }

    fn consume_variable(&mut self, trim_open: bool) -> Result<Token> {
        let vs = &self.tags.variable_start;
        let vs_trim = format!("{vs}-");
        let rest = self.rest();
        let open_len = if rest.starts_with(vs_trim.as_str()) {
            vs_trim.len()
        } else {
            vs.len()
        };
        self.position += open_len;
        let after_open = self.rest();
        let (body_end, close_len) = find_var_close(after_open, &self.tags)?;
        let trim_close_marker = format!("-{}", self.tags.variable_end);
        let trim_close = after_open[body_end..].starts_with(trim_close_marker.as_str());
        let body = &after_open[..body_end];
        let expr = apply_var_trim(body, trim_open, trim_close);
        self.position += body_end + close_len;
        if trim_close {
            self.strip_leading_next_text = true;
        }
        Ok(Token::Expression(expr))
    }

    fn consume_tag_at_position(&mut self) -> Result<String> {
        let rest = self.rest();
        let (body, total, trim_close) = parse_tag_prefix(rest, &self.tags)?;
        self.position += total;
        // Nunjucks quirk: the `-%}` of a block-capture `{% set x -%}` does not strip the
        // start of the captured body (govuk-frontend's pagination relies on this).
        let is_block_set = body.trim_start().strip_prefix("set ").is_some_and(|t| !t.contains('='));
        if trim_close && !is_block_set {
            self.strip_leading_next_text = true;
        } else if self.opts.trim_blocks {
            self.trim_block_newline = true;
        }
        Ok(body)
    }

    fn end_tag_name(mode: LexerMode) -> &'static str {
        match mode {
            LexerMode::Raw => "endraw",
            LexerMode::Verbatim => "endverbatim",
            LexerMode::Normal => "",
        }
    }

    fn open_tag_name(mode: LexerMode) -> &'static str {
        match mode {
            LexerMode::Raw => "raw",
            LexerMode::Verbatim => "verbatim",
            LexerMode::Normal => "",
        }
    }

    fn next_token_block_mode(&mut self) -> Result<Option<Token>> {
        let mode = self.mode;
        let open_name = Self::open_tag_name(mode);
        let end_name = Self::end_tag_name(mode);
        let rest = self.rest();
        let idx = find_matching_block_close(rest, open_name, end_name, &self.tags)?;
        let mut literal = rest[..idx].to_string();
        // Consume `trimBlocks` from the opening `{% raw %}` / `{% verbatim %}` tag so it does not
        // apply to text that follows `{% endraw %}` / `{% endverbatim %}` (matches Nunjucks).
        self.apply_leading_strip(&mut literal);
        self.position += idx;
        let rest2 = self.rest();
        let (body, total, trim_close) = parse_tag_prefix(rest2, &self.tags)?;
        self.position += total;
        if trim_close {
            self.strip_leading_next_text = true;
        }
        self.mode = LexerMode::Normal;
        if !literal.is_empty() {
            self.pending = Some(Token::Tag(body));
            return Ok(Some(Token::Text(literal)));
        }
        Ok(Some(Token::Tag(body)))
    }

    /// Apply `trim_blocks` (strip leading `\n`) and `strip_leading_next_text` (`-%}` / `-}}`) to a text fragment.
    fn apply_leading_strip(&mut self, text: &mut String) {
        if self.strip_leading_next_text {
            *text = text.trim_start().to_string();
            self.strip_leading_next_text = false;
            self.trim_block_newline = false;
        } else if self.trim_block_newline {
            if text.starts_with('\n') {
                text.remove(0);
            } else if text.starts_with("\r\n") {
                text.drain(..2);
            }
            self.trim_block_newline = false;
        }
    }

    /// When `lstrip_blocks` is enabled, strip trailing spaces/tabs that sit on the same line before a block tag or comment opener.
    ///
    /// Only strips when the opener is the first non-whitespace content on its line (i.e. only
    /// horizontal whitespace appears between the preceding newline (or start of text) and the opener).
    fn apply_lstrip_trailing(&self, text: &mut String, kind: OpenKind) {
        if !self.opts.lstrip_blocks {
            return;
        }
        let is_block = matches!(kind, OpenKind::Tag { .. } | OpenKind::Comment { .. });
        if !is_block {
            return;
        }
        if let Some(nl) = text.rfind('\n') {
            let after_nl = &text[nl + 1..];
            if after_nl.chars().all(|c| c == ' ' || c == '\t') {
                text.truncate(nl + 1);
            }
        } else if text.chars().all(|c| c == ' ' || c == '\t') {
            text.clear();
        }
    }

    fn next_token_normal(&mut self) -> Result<Option<Token>> {
        loop {
            if self.is_eof() {
                return Ok(None);
            }

            let rest = self.rest();

            match next_opener(rest, &self.tags) {
                None => {
                    let mut text = rest.to_owned();
                    self.apply_leading_strip(&mut text);
                    self.position = self.input.len();
                    return Ok(Some(Token::Text(text)));
                }
                Some((0, OpenKind::Comment { .. })) => {
                    self.skip_comment()?;
                    continue;
                }
                Some((0, OpenKind::Tag { .. })) => {
                    let body = self.consume_tag_at_position()?;
                    if body == "raw" || body.starts_with("raw ") {
                        self.mode = LexerMode::Raw;
                    } else if body == "verbatim" || body.starts_with("verbatim ") {
                        self.mode = LexerMode::Verbatim;
                    }
                    return Ok(Some(Token::Tag(body)));
                }
                Some((0, OpenKind::Var { trim_open })) => {
                    return self.consume_variable(trim_open).map(Some);
                }
                Some((idx, kind)) => {
                    let mut text = rest[..idx].to_owned();
                    self.apply_leading_strip(&mut text);
                    let trim_open = matches!(
                        kind,
                        OpenKind::Tag { trim_open: true }
                            | OpenKind::Var { trim_open: true }
                            | OpenKind::Comment { trim_open: true }
                    );
                    if trim_open {
                        text = text.trim_end().to_string();
                    }
                    self.apply_lstrip_trailing(&mut text, kind);
                    self.position += idx;
                    if text.is_empty() {
                        continue;
                    }
                    return Ok(Some(Token::Text(text)));
                }
            }
        }
    }

    pub fn next_token(&mut self) -> Result<Option<Token>> {
        if let Some(t) = self.pending.take() {
            return Ok(Some(t));
        }
        match self.mode {
            LexerMode::Normal => self.next_token_normal(),
            LexerMode::Raw | LexerMode::Verbatim => self.next_token_block_mode(),
        }
    }
}

/// Tokenizes the full `input` into a [`Vec`] of [`Token`]s.
///
/// An empty string yields a single [`Token::Text`] with empty content.
///
/// # Examples
///
/// ```
/// use runjucks_core::lexer::{tokenize, Token};
///
/// let tokens = tokenize("Hi {{ name }}").unwrap();
/// assert!(matches!(tokens[0], Token::Text(_)));
/// assert!(matches!(tokens[1], Token::Expression(_)));
/// ```
pub fn tokenize(input: &str) -> Result<Vec<Token>> {
    tokenize_with_options(input, LexerOptions::default())
}

/// Like [`tokenize`] but with explicit [`LexerOptions`].
pub fn tokenize_with_options(input: &str, opts: LexerOptions) -> Result<Vec<Token>> {
    if input.is_empty() {
        return Ok(vec![Token::Text(String::new())]);
    }
    let mut lexer = Lexer::with_options(input, opts);
    // Heuristic: fewer tokens for long plain-text runs; more when delimiter-heavy. Cap to avoid huge
    // allocations on pathological inputs (full arena/interning is deferred until parse benches justify it).
    let est = (input.len() / 24).saturating_add(4).min(8192);
    let mut tokens = Vec::with_capacity(est);
    while let Some(t) = lexer.next_token()? {
        tokens.push(t);
    }
    Ok(tokens)
}
