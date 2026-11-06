//! The highlight.js 11 engine (`lib/core.js`): the mode compiler's matcher
//! (`ResumableMultiRegex` / `MultiRegex`), `_highlight`, and the token-tree emitter with its
//! HTML renderer. Grammars are the modes highlight.js itself compiled (`grammars.json`, exported
//! by `rust/highlight-port/export.cjs`), so only the engine and the grammar callbacks are code.

use std::collections::HashMap;
use std::sync::{Arc, OnceLock};

use serde::Deserialize;

use super::jsregex::{self, Flags};

// ---------------------------------------------------------------------------------------------
// Grammar data.

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GrammarFile {
    languages: HashMap<String, LanguageData>,
    aliases: HashMap<String, String>,
    modes: Vec<ModeData>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LanguageData {
    root: usize,
    case_insensitive: bool,
    unicode_regex: bool,
    class_name_aliases: HashMap<String, String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ModeData {
    scope: Option<String>,
    begin_scope: Option<serde_json::Map<String, serde_json::Value>>,
    end_scope: Option<serde_json::Map<String, serde_json::Value>>,
    begin: Option<String>,
    end: Option<String>,
    terminator_end: Option<String>,
    illegal: Option<String>,
    keywords: Option<HashMap<String, (String, f64)>>,
    keyword_pattern: Option<String>,
    return_begin: bool,
    return_end: bool,
    exclude_begin: bool,
    exclude_end: bool,
    ends_with_parent: bool,
    ends_parent: bool,
    skip: bool,
    sub_language: Option<String>,
    before_begin: Option<String>,
    on_begin: Option<String>,
    on_end: Option<String>,
    contains: Vec<usize>,
    starts: Option<usize>,
}

/// `beginScope` / `endScope` after `MultiClass`: `{ _wrap }` or numbered scopes with `_emit`.
#[derive(Debug, Default)]
struct ScopeSpec {
    wrap: Option<String>,
    multi: bool,
    names: HashMap<usize, String>,
    emit: Vec<usize>,
}

impl ScopeSpec {
    fn from(map: &serde_json::Map<String, serde_json::Value>) -> Self {
        let mut spec = ScopeSpec::default();
        for (k, v) in map {
            match k.as_str() {
                "_wrap" => spec.wrap = v.as_str().map(str::to_string),
                "_multi" => spec.multi = v.as_bool() == Some(true),
                "_emit" => spec.emit = v.as_array().into_iter().flatten().filter_map(|n| n.as_u64()).map(|n| n as usize).collect(),
                n => {
                    if let (Ok(i), Some(name)) = (n.parse::<usize>(), v.as_str()) {
                        spec.names.insert(i, name.to_string());
                    }
                }
            }
        }
        spec.emit.sort_unstable();
        spec
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Callback {
    SkipIfHasPrecedingDot,
    Shebang,
    EndSameAsBeginStart,
    EndSameAsBeginEnd,
    IsTrulyOpeningTag,
}

fn callback(name: &Option<String>) -> Option<Callback> {
    Some(match name.as_deref()? {
        "skipIfHasPrecedingDot" => Callback::SkipIfHasPrecedingDot,
        "shebang" => Callback::Shebang,
        "endSameAsBeginStart" => Callback::EndSameAsBeginStart,
        "endSameAsBeginEnd" => Callback::EndSameAsBeginEnd,
        "isTrulyOpeningTag" => Callback::IsTrulyOpeningTag,
        other => panic!("unknown highlight.js callback {other}"),
    })
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum RuleKind {
    Begin,
    End,
    Illegal,
}

struct Mode {
    data: ModeData,
    begin_scope: Option<ScopeSpec>,
    end_scope: Option<ScopeSpec>,
    before_begin: Option<Callback>,
    on_begin: Option<Callback>,
    on_end: Option<Callback>,
    /// `buildModeRegex`: `(source, kind, rule)` in matcher order.
    rules: Vec<(String, RuleKind, Option<usize>)>,
    begin_count: usize,
    /// Flags of the language this mode belongs to (the one that compiled it).
    flags: Flags,
    end_re: OnceLock<Option<fancy_regex::Regex>>,
    keyword_re: OnceLock<fancy_regex::Regex>,
    /// `ResumableMultiRegex.getMatcher(index)`, per language flags.
    matchers: OnceLock<Vec<OnceLock<Arc<MultiRegex>>>>,
}

struct Language {
    root: usize,
    flags: Flags,
    class_name_aliases: HashMap<String, String>,
}

pub struct Registry {
    languages: HashMap<String, Language>,
    aliases: HashMap<String, String>,
    modes: Vec<Mode>,
}

impl Registry {
    pub fn load(json: &str) -> Self {
        let file: GrammarFile = serde_json::from_str(json).expect("highlight.js grammars");
        let mut flags_of: Vec<Option<Flags>> = vec![None; file.modes.len()];
        // Each mode takes the flags of the first language (in registration order) that reaches it.
        let mut names: Vec<&String> = file.languages.keys().collect();
        names.sort_by_key(|n| file.languages[*n].root);
        for name in names {
            let l = &file.languages[name];
            let flags = Flags { case_insensitive: l.case_insensitive, unicode: l.unicode_regex };
            let mut stack = vec![l.root];
            while let Some(m) = stack.pop() {
                if flags_of[m].is_some() {
                    continue;
                }
                flags_of[m] = Some(flags);
                stack.extend(file.modes[m].contains.iter().copied());
                stack.extend(file.modes[m].starts);
            }
        }
        let modes = file
            .modes
            .into_iter()
            .enumerate()
            .map(|(id, data)| {
                let _ = id;
                Mode {
                    begin_scope: data.begin_scope.as_ref().map(ScopeSpec::from),
                    end_scope: data.end_scope.as_ref().map(ScopeSpec::from),
                    before_begin: callback(&data.before_begin),
                    on_begin: callback(&data.on_begin),
                    on_end: callback(&data.on_end),
                    rules: Vec::new(),
                    begin_count: 0,
                    flags: Flags::default(),
                    end_re: OnceLock::new(),
                    keyword_re: OnceLock::new(),
                    matchers: OnceLock::new(),
                    data,
                }
            })
            .collect::<Vec<_>>();
        let mut registry = Registry {
            languages: file
                .languages
                .into_iter()
                .map(|(name, l)| {
                    let flags = Flags { case_insensitive: l.case_insensitive, unicode: l.unicode_regex };
                    (name, Language { root: l.root, flags, class_name_aliases: l.class_name_aliases })
                })
                .collect(),
            aliases: file.aliases,
            modes,
        };
        for id in 0..registry.modes.len() {
            let mut rules = Vec::new();
            for &child in &registry.modes[id].data.contains {
                let begin = registry.modes[child].data.begin.clone().unwrap_or_default();
                rules.push((begin, RuleKind::Begin, Some(child)));
            }
            let begin_count = rules.len();
            if let Some(t) = registry.modes[id].data.terminator_end.clone().filter(|t| !t.is_empty()) {
                rules.push((t, RuleKind::End, None));
            }
            if let Some(ill) = registry.modes[id].data.illegal.clone().filter(|t| !t.is_empty()) {
                rules.push((ill, RuleKind::Illegal, None));
            }
            let mode = &mut registry.modes[id];
            mode.rules = rules;
            mode.begin_count = begin_count;
            mode.flags = flags_of[id].unwrap_or_default();
        }
        registry
    }

    /// `getLanguage`: by name, then by alias (lowercased).
    pub fn language_name(&self, name: &str) -> Option<String> {
        let name = name.to_lowercase();
        if self.languages.contains_key(&name) {
            return Some(name);
        }
        self.aliases.get(&name).filter(|n| self.languages.contains_key(*n)).cloned()
    }

    fn end_re(&self, mode: usize) -> Option<&fancy_regex::Regex> {
        let m = &self.modes[mode];
        m.end_re
            .get_or_init(|| m.data.end.as_ref().map(|e| jsregex::compile(e, m.flags).expect("end regex")))
            .as_ref()
    }

    fn keyword_re(&self, mode: usize) -> &fancy_regex::Regex {
        let m = &self.modes[mode];
        m.keyword_re.get_or_init(|| {
            jsregex::compile(m.data.keyword_pattern.as_deref().unwrap_or(r"\w+"), m.flags).expect("keyword regex")
        })
    }

    /// `ResumableMultiRegex.getMatcher(index)`, compiled with the highlighting language's flags.
    fn matcher(&self, mode: usize, index: usize, flags: Flags) -> Arc<MultiRegex> {
        let m = &self.modes[mode];
        let slots = m.matchers.get_or_init(|| (0..=m.rules.len()).map(|_| OnceLock::new()).collect());
        slots[index].get_or_init(|| Arc::new(MultiRegex::new(&m.rules[index..], index, flags))).clone()
    }
}

// ---------------------------------------------------------------------------------------------
// Matching.

/// `MultiRegex`: the rules joined into one alternation, each in its own group.
struct MultiRegex {
    re: Option<fancy_regex::Regex>,
    /// Group number -> (position within this matcher, kind, rule).
    match_indexes: HashMap<usize, (usize, RuleKind, Option<usize>)>,
}

impl MultiRegex {
    fn new(rules: &[(String, RuleKind, Option<usize>)], _offset: usize, flags: Flags) -> Self {
        let mut match_indexes = HashMap::new();
        let mut match_at = 1;
        for (position, (source, kind, rule)) in rules.iter().enumerate() {
            match_indexes.insert(match_at, (position, *kind, *rule));
            match_at += jsregex::count_groups(source) + 1;
        }
        let re = (!rules.is_empty()).then(|| {
            let sources: Vec<&str> = rules.iter().map(|r| r.0.as_str()).collect();
            jsregex::compile(&jsregex::rewrite_backreferences(&sources, "|"), flags).expect("matcher regex")
        });
        MultiRegex { re, match_indexes }
    }

    fn exec(&self, s: &str, last_index: usize) -> Option<Match> {
        let re = self.re.as_ref()?;
        if last_index > s.len() {
            return None;
        }
        let caps = re.captures_from_pos(s, last_index).ok()??;
        let i = (1..caps.len()).find(|&i| caps.get(i).is_some())?;
        let (position, kind, rule) = self.match_indexes[&i];
        let groups = (i..caps.len()).map(|g| caps.get(g).map(|m| (m.start(), m.end()))).collect();
        Some(Match { index: caps.get(0).unwrap().start(), groups, kind, rule, position })
    }
}

#[derive(Clone, Debug)]
struct Match {
    index: usize,
    /// `match[0..]` after the splice: the rule's whole match, then its inner groups.
    groups: Vec<Option<(usize, usize)>>,
    kind: RuleKind,
    rule: Option<usize>,
    position: usize,
}

impl Match {
    fn text<'a>(&self, input: &'a str, i: usize) -> Option<&'a str> {
        self.groups.get(i).copied().flatten().map(|(a, b)| &input[a..b])
    }

    fn lexeme<'a>(&self, input: &'a str) -> &'a str {
        self.text(input, 0).unwrap_or("")
    }
}

// ---------------------------------------------------------------------------------------------
// Emitter (`TokenTreeEmitter`) and renderer (`HTMLRenderer`).

#[derive(Clone, Debug)]
enum Node {
    Text(String),
    /// `addText(undefined)` from a non-participating group: renders nothing.
    Nothing,
    Scope { scope: Option<String>, children: Vec<usize> },
}

#[derive(Clone, Debug)]
struct Emitter {
    nodes: Vec<Node>,
    stack: Vec<usize>,
}

impl Emitter {
    fn new() -> Self {
        Emitter { nodes: vec![Node::Scope { scope: None, children: Vec::new() }], stack: vec![0] }
    }

    fn add(&mut self, node: Node) -> usize {
        let id = self.nodes.len();
        self.nodes.push(node);
        let top = *self.stack.last().unwrap();
        if let Node::Scope { children, .. } = &mut self.nodes[top] {
            children.push(id);
        }
        id
    }

    fn add_text(&mut self, text: &str) {
        if !text.is_empty() {
            self.add(Node::Text(text.to_string()));
        }
    }

    fn open_node(&mut self, scope: &str) {
        let id = self.add(Node::Scope { scope: Some(scope.to_string()), children: Vec::new() });
        self.stack.push(id);
    }

    fn close_node(&mut self) {
        if self.stack.len() > 1 {
            self.stack.pop();
        }
    }

    /// `__addSublanguage`: grafts the other emitter's root, scoped `language:<name>`.
    fn add_sublanguage(&mut self, other: &Emitter, name: &str) {
        fn graft(dst: &mut Emitter, src: &Emitter, node: usize, scope: Option<String>) -> usize {
            match &src.nodes[node] {
                Node::Scope { scope: own, children } => {
                    let kids: Vec<usize> = children.iter().map(|&c| graft(dst, src, c, None)).collect();
                    let id = dst.nodes.len();
                    dst.nodes.push(Node::Scope { scope: scope.or_else(|| own.clone()), children: kids });
                    id
                }
                other => {
                    let id = dst.nodes.len();
                    dst.nodes.push(other.clone());
                    id
                }
            }
        }
        let id = graft(self, other, 0, Some(format!("language:{name}")));
        let top = *self.stack.last().unwrap();
        if let Node::Scope { children, .. } = &mut self.nodes[top] {
            children.push(id);
        }
    }

    fn finalize(&mut self) {
        while self.stack.len() > 1 {
            self.stack.pop();
        }
    }

    fn to_html(&self) -> String {
        let mut out = String::new();
        self.walk(0, &mut out);
        out
    }

    fn walk(&self, node: usize, out: &mut String) {
        match &self.nodes[node] {
            Node::Text(t) => out.push_str(&escape_html(t)),
            Node::Nothing => {}
            Node::Scope { scope, children } => {
                if let Some(s) = scope {
                    out.push_str("<span class=\"");
                    out.push_str(&scope_to_css_class(s));
                    out.push_str("\">");
                }
                for &c in children {
                    self.walk(c, out);
                }
                if scope.is_some() {
                    out.push_str("</span>");
                }
            }
        }
    }
}

/// `escapeHTML`.
pub fn escape_html(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for c in value.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&#x27;"),
            c => out.push(c),
        }
    }
    out
}

/// `scopeToCSSClass` with the `hljs-` prefix.
fn scope_to_css_class(name: &str) -> String {
    if let Some(rest) = name.strip_prefix("language:") {
        return format!("language-{rest}");
    }
    if name.contains('.') {
        let mut pieces = name.split('.');
        let first = pieces.next().unwrap_or_default();
        let mut parts = vec![format!("hljs-{first}")];
        parts.extend(pieces.enumerate().map(|(i, p)| format!("{p}{}", "_".repeat(i + 1))));
        return parts.join(" ");
    }
    format!("hljs-{name}")
}

// ---------------------------------------------------------------------------------------------
// `_highlight`.

/// `HighlightResult`, as far as callers use it.
pub struct HighlightResult {
    pub value: String,
    /// An illegal lexeme ended highlighting (`ignoreIllegals: false`); `value` is the escaped code.
    #[allow(dead_code)]
    pub illegal: bool,
    emitter: Emitter,
    top: Vec<usize>,
}

enum Illegal {
    /// An illegal lexeme with `ignoreIllegals` false.
    Lexeme,
    /// Any other failure (highlight.js's SAFE_MODE catch): escaped code, not marked illegal.
    Error,
}

const JS_SPACE: &[char] = &[
    '\t', '\n', '\x0B', '\x0C', '\r', ' ', '\u{A0}', '\u{1680}', '\u{2000}', '\u{2001}', '\u{2002}', '\u{2003}', '\u{2004}',
    '\u{2005}', '\u{2006}', '\u{2007}', '\u{2008}', '\u{2009}', '\u{200A}', '\u{2028}', '\u{2029}', '\u{202F}', '\u{205F}',
    '\u{3000}', '\u{FEFF}',
];

fn is_js_space(c: char) -> bool {
    JS_SPACE.contains(&c)
}

struct Highlighter<'r> {
    registry: &'r Registry,
    language: &'r Language,
    code: &'r str,
    ignore_illegals: bool,
    emitter: Emitter,
    /// The mode stack (`top` and its `parent` chain); `stack[0]` is the language root.
    stack: Vec<usize>,
    mode_buffer: String,
    /// `matcher.regexIndex`, per mode.
    regex_index: HashMap<usize, usize>,
    /// `mode.data._beginMatch` (END_SAME_AS_BEGIN), per mode.
    begin_match: HashMap<usize, Option<String>>,
    continuations: HashMap<String, Vec<usize>>,
    resume_scan_at_same_position: bool,
    last_match: Option<(RuleKind, usize)>,
}

enum EndResult {
    NoMatch,
    Processed(usize),
}

impl<'r> Highlighter<'r> {
    fn top(&self) -> usize {
        *self.stack.last().unwrap()
    }

    fn mode(&self, id: usize) -> &'r Mode {
        &self.registry.modes[id]
    }

    fn alias<'a>(&'a self, scope: &'a str) -> &'a str {
        self.language.class_name_aliases.get(scope).map(String::as_str).unwrap_or(scope)
    }

    /// `ResumableMultiRegex.exec`.
    fn exec(&mut self, last_index: usize) -> Option<Match> {
        let top = self.top();
        let flags = self.language.flags;
        let index = self.regex_index.get(&top).copied().unwrap_or(0);
        let m = self.registry.matcher(top, index, flags);
        let mut result = m.exec(self.code, last_index);
        if index != 0 && !result.as_ref().is_some_and(|r| r.index == last_index) {
            let m2 = self.registry.matcher(top, 0, flags);
            result = m2.exec(self.code, next_char(self.code, last_index));
        }
        if let Some(r) = &result {
            let count = self.mode(top).begin_count;
            let mut next = index + r.position + 1;
            if next == count {
                next = 0;
            }
            self.regex_index.insert(top, next);
        }
        result
    }

    fn process_keywords(&mut self) {
        let top = self.top();
        let Some(keywords) = &self.mode(top).data.keywords else {
            let buffer = std::mem::take(&mut self.mode_buffer);
            self.emitter.add_text(&buffer);
            self.mode_buffer = buffer;
            return;
        };
        let buffer = self.mode_buffer.clone();
        let re = self.registry.keyword_re(top);
        let mut last_index = 0;
        let mut buf = String::new();
        let mut pos = 0;
        while pos <= buffer.len() {
            let Ok(Some(m)) = re.find_from_pos(&buffer, pos) else { break };
            buf.push_str(&buffer[last_index..m.start()]);
            let word = if self.language.flags.case_insensitive { m.as_str().to_lowercase() } else { m.as_str().to_string() };
            match keywords.get(&word) {
                Some((kind, _relevance)) => {
                    self.emitter.add_text(&buf);
                    buf.clear();
                    if kind.starts_with('_') {
                        buf.push_str(m.as_str());
                    } else {
                        let class = self.alias(kind).to_string();
                        self.emit_keyword(Some(m.as_str()), &class);
                    }
                }
                None => buf.push_str(m.as_str()),
            }
            last_index = m.end();
            pos = if m.end() == m.start() { next_char(&buffer, m.end()) } else { m.end() };
        }
        buf.push_str(&buffer[last_index.min(buffer.len())..]);
        self.emitter.add_text(&buf);
    }

    fn process_sub_language(&mut self) {
        if self.mode_buffer.is_empty() {
            return;
        }
        let sub = self.mode(self.top()).data.sub_language.clone().unwrap_or_default();
        // `languages[top.subLanguage]`: registered names only, no aliases.
        if !self.registry.languages.contains_key(&sub) {
            let buffer = std::mem::take(&mut self.mode_buffer);
            self.emitter.add_text(&buffer);
            return;
        }
        let continuation = self.continuations.get(&sub).cloned();
        let result = highlight_with(self.registry, &sub, &self.mode_buffer, true, continuation);
        self.continuations.insert(sub.clone(), result.top.clone());
        self.emitter.add_sublanguage(&result.emitter, &sub);
    }

    fn process_buffer(&mut self) {
        if self.mode(self.top()).data.sub_language.is_some() {
            self.process_sub_language();
        } else {
            self.process_keywords();
        }
        self.mode_buffer.clear();
    }

    /// `emitKeyword`: `None` is JS `undefined` (a group that did not participate).
    fn emit_keyword(&mut self, keyword: Option<&str>, scope: &str) {
        if keyword == Some("") {
            return;
        }
        self.emitter.open_node(scope);
        match keyword {
            Some(k) => self.emitter.add_text(k),
            None => {
                self.emitter.add(Node::Nothing);
            }
        }
        self.emitter.close_node();
    }

    fn emit_multi_class(&mut self, scope: &ScopeSpec, m: &Match) {
        let max = m.groups.len().saturating_sub(1);
        for i in 1..=max {
            if !scope.emit.contains(&i) {
                continue;
            }
            let text = m.text(self.code, i);
            match scope.names.get(&i) {
                Some(name) => {
                    let class = self.alias(name).to_string();
                    self.emit_keyword(text, &class);
                }
                None => {
                    // `modeBuffer = text` (`undefined` coerces to "undefined" in the keyword scan).
                    self.mode_buffer = text.map(str::to_string).unwrap_or_else(|| {
                        if self.mode(self.top()).data.keywords.is_some() { "undefined".into() } else { String::new() }
                    });
                    self.process_keywords();
                    self.mode_buffer.clear();
                }
            }
        }
    }

    fn start_new_mode(&mut self, mode: usize, m: &Match) {
        let data = &self.mode(mode).data;
        if let Some(scope) = &data.scope {
            let class = self.alias(scope).to_string();
            self.emitter.open_node(&class);
        }
        if let Some(begin_scope) = &self.mode(mode).begin_scope {
            if let Some(wrap) = &begin_scope.wrap {
                let class = self.alias(wrap).to_string();
                let buffer = std::mem::take(&mut self.mode_buffer);
                self.emit_keyword(Some(&buffer), &class);
            } else if begin_scope.multi {
                self.emit_multi_class(begin_scope, m);
                self.mode_buffer.clear();
            }
        }
        self.stack.push(mode);
    }

    /// Runs a callback; `true` when it ignores the match (`response.ignoreMatch()`).
    fn run_callback(&mut self, cb: Callback, mode: usize, m: &Match) -> bool {
        let input = self.code;
        match cb {
            Callback::SkipIfHasPrecedingDot => input[..m.index].ends_with('.'),
            Callback::Shebang => m.index != 0,
            Callback::EndSameAsBeginStart => {
                self.begin_match.insert(mode, m.text(input, 1).map(str::to_string));
                false
            }
            Callback::EndSameAsBeginEnd => {
                let begin = self.begin_match.get(&mode).cloned().flatten();
                begin.as_deref() != m.text(input, 1)
            }
            Callback::IsTrulyOpeningTag => {
                let lexeme = m.lexeme(input);
                let after = m.index + lexeme.len();
                let next = input[after..].chars().next();
                if matches!(next, Some('<' | ',')) {
                    return true;
                }
                if next == Some('>') {
                    // `hasClosingTag`
                    let tag = format!("</{}", &lexeme[1..]);
                    if !input[after..].contains(&tag) {
                        return true;
                    }
                }
                let rest = &input[after..];
                // /^\s*=/
                if rest.trim_start_matches(is_js_space).starts_with('=') {
                    return true;
                }
                // /^\s+extends\s+/
                let trimmed = rest.trim_start_matches(is_js_space);
                if trimmed.len() < rest.len()
                    && let Some(after_kw) = trimmed.strip_prefix("extends")
                    && after_kw.starts_with(is_js_space)
                {
                    return true;
                }
                false
            }
        }
    }

    /// `doIgnore`.
    fn do_ignore(&mut self, lexeme: &str) -> usize {
        let top = self.top();
        if self.regex_index.get(&top).copied().unwrap_or(0) == 0 {
            let first = lexeme.chars().next();
            if let Some(c) = first {
                self.mode_buffer.push(c);
            }
            first.map_or(1, char::len_utf8)
        } else {
            self.resume_scan_at_same_position = true;
            0
        }
    }

    fn do_begin_match(&mut self, m: &Match) -> usize {
        let lexeme = m.lexeme(self.code);
        let new_mode = m.rule.expect("begin rule");
        let mode = self.mode(new_mode);
        for cb in [mode.before_begin, mode.on_begin].into_iter().flatten() {
            if self.run_callback(cb, new_mode, m) {
                return self.do_ignore(lexeme);
            }
        }
        let data = &mode.data;
        if data.skip {
            self.mode_buffer.push_str(lexeme);
        } else {
            if data.exclude_begin {
                self.mode_buffer.push_str(lexeme);
            }
            self.process_buffer();
            if !data.return_begin && !data.exclude_begin {
                self.mode_buffer = lexeme.to_string();
            }
        }
        self.start_new_mode(new_mode, m);
        if data.return_begin { 0 } else { lexeme.len() }
    }

    /// `endOfMode`, over stack depths: the depth of the mode that ends.
    fn end_of_mode(&mut self, depth: usize, m: &Match, from: usize) -> Option<usize> {
        let mode = self.stack[depth];
        let rest = &self.code[from..];
        let mut matched = self.registry.end_re(mode).is_some_and(|re| matches!(re.find(rest), Ok(Some(f)) if f.start() == 0));
        if matched {
            if let Some(cb) = self.mode(mode).on_end
                && self.run_callback(cb, mode, m)
            {
                matched = false;
            }
            if matched {
                let mut d = depth;
                while self.mode(self.stack[d]).data.ends_parent && d > 0 {
                    d -= 1;
                }
                return Some(d);
            }
        }
        if self.mode(mode).data.ends_with_parent && depth > 0 {
            return self.end_of_mode(depth - 1, m, from);
        }
        None
    }

    fn do_end_match(&mut self, m: &Match) -> EndResult {
        let lexeme = m.lexeme(self.code);
        let Some(end_depth) = self.end_of_mode(self.stack.len() - 1, m, m.index) else { return EndResult::NoMatch };
        let origin = self.top();
        let origin_mode = self.mode(origin);
        if let Some(wrap) = origin_mode.end_scope.as_ref().and_then(|s| s.wrap.clone()) {
            self.process_buffer();
            self.emit_keyword(Some(lexeme), &wrap);
        } else if let Some(spec) = origin_mode.end_scope.as_ref().filter(|s| s.multi) {
            self.process_buffer();
            self.emit_multi_class(spec, m);
        } else if origin_mode.data.skip {
            self.mode_buffer.push_str(lexeme);
        } else {
            if !(origin_mode.data.return_end || origin_mode.data.exclude_end) {
                self.mode_buffer.push_str(lexeme);
            }
            self.process_buffer();
            if origin_mode.data.exclude_end {
                self.mode_buffer = lexeme.to_string();
            }
        }
        let end_mode = self.stack[end_depth];
        while self.stack.len() > end_depth {
            if self.mode(self.top()).data.scope.is_some() {
                self.emitter.close_node();
            }
            self.stack.pop();
        }
        if let Some(starts) = self.mode(end_mode).data.starts {
            self.start_new_mode(starts, m);
        }
        EndResult::Processed(if origin_mode.data.return_end { 0 } else { lexeme.len() })
    }

    /// `processLexeme`.
    fn process_lexeme(&mut self, before: &str, m: Option<&Match>) -> Result<usize, Illegal> {
        self.mode_buffer.push_str(before);
        let Some(m) = m else {
            self.process_buffer();
            return Ok(0);
        };
        let lexeme = m.lexeme(self.code);
        if let Some((RuleKind::Begin, last_index)) = self.last_match
            && m.kind == RuleKind::End
            && last_index == m.index
            && lexeme.is_empty()
        {
            // 0-width match after a begin at the same index: emit the next character (SAFE_MODE).
            let c = self.code[m.index..].chars().next();
            if let Some(c) = c {
                self.mode_buffer.push(c);
            }
            return Ok(c.map_or(1, char::len_utf8));
        }
        self.last_match = Some((m.kind, m.index));
        match m.kind {
            RuleKind::Begin => return Ok(self.do_begin_match(m)),
            RuleKind::Illegal if !self.ignore_illegals => return Err(Illegal::Lexeme),
            RuleKind::End => {
                if let EndResult::Processed(n) = self.do_end_match(m) {
                    return Ok(n);
                }
            }
            RuleKind::Illegal => {}
        }
        if m.kind == RuleKind::Illegal && lexeme.is_empty() {
            if m.index != self.code.len() {
                self.mode_buffer.push('\n');
            }
            return Ok(1);
        }
        self.mode_buffer.push_str(lexeme);
        Ok(lexeme.len())
    }

    fn run(&mut self) -> Result<(), Illegal> {
        let mut index = 0;
        let mut iterations = 0usize;
        self.regex_index.insert(self.top(), 0);
        loop {
            iterations += 1;
            if self.resume_scan_at_same_position {
                self.resume_scan_at_same_position = false;
            } else {
                self.regex_index.insert(self.top(), 0);
            }
            let Some(m) = self.exec(index) else { break };
            // 'potential infinite loop, way more iterations than matches'
            if iterations > 100_000 && iterations > m.index * 3 {
                return Err(Illegal::Error);
            }
            let before = &self.code[index.min(m.index)..m.index];
            let processed = self.process_lexeme(before, Some(&m))?;
            index = m.index + processed;
        }
        let rest = &self.code[index.min(self.code.len())..];
        self.process_lexeme(rest, None)?;
        Ok(())
    }
}

fn next_char(s: &str, i: usize) -> usize {
    if i >= s.len() {
        return i + 1;
    }
    i + s[i..].chars().next().map_or(1, char::len_utf8)
}

/// `_highlight(languageName, code, ignoreIllegals, continuation)`; `name` must be registered.
pub fn highlight_with(
    registry: &Registry,
    name: &str,
    code: &str,
    ignore_illegals: bool,
    continuation: Option<Vec<usize>>,
) -> HighlightResult {
    let language = &registry.languages[name];
    let mut h = Highlighter {
        registry,
        language,
        code,
        ignore_illegals,
        emitter: Emitter::new(),
        stack: continuation.unwrap_or_else(|| vec![language.root]),
        mode_buffer: String::new(),
        regex_index: HashMap::new(),
        begin_match: HashMap::new(),
        continuations: HashMap::new(),
        resume_scan_at_same_position: false,
        last_match: None,
    };
    // `processContinuations`: reopen the scopes of a continued sub-language.
    let scopes: Vec<String> =
        h.stack.iter().skip(1).filter_map(|&m| registry.modes[m].data.scope.clone()).collect();
    for s in scopes {
        h.emitter.open_node(&s);
    }
    match h.run() {
        Ok(()) => {
            h.emitter.finalize();
            HighlightResult { value: h.emitter.to_html(), illegal: false, top: h.stack, emitter: h.emitter }
        }
        Err(failure) => HighlightResult {
            value: escape_html(code),
            illegal: matches!(failure, Illegal::Lexeme),
            top: h.stack,
            emitter: h.emitter,
        },
    }
}
