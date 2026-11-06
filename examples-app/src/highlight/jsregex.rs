//! JavaScript regular expressions on `fancy-regex`, with JavaScript semantics.
//!
//! highlight.js grammars are JS regex sources compiled with `m` (plus `i` / `u` per language).
//! The translation keeps capture-group numbering intact (everything it adds is non-capturing) and
//! maps the constructs whose meaning differs: `\d`, `\w`, `\s`, `\b`, `\B` are ASCII / JS-specific
//! in JavaScript but Unicode in Rust; a `{` that is not a quantifier is a literal in JavaScript;
//! character classes have no nesting or set operators in JavaScript.

use std::fmt::Write as _;

/// JavaScript's `\s` (WhiteSpace and LineTerminator).
const JS_SPACE: &str = r"\t\n\x{0B}\x{0C}\r \x{A0}\x{1680}\x{2000}-\x{200A}\x{2028}\x{2029}\x{202F}\x{205F}\x{3000}\x{FEFF}";
const WORD: &str = "A-Za-z0-9_";
const BOUNDARY: &str = r"(?:(?<=[A-Za-z0-9_])(?![A-Za-z0-9_])|(?<![A-Za-z0-9_])(?=[A-Za-z0-9_]))";
const NOT_BOUNDARY: &str = r"(?:(?<=[A-Za-z0-9_])(?=[A-Za-z0-9_])|(?<![A-Za-z0-9_])(?![A-Za-z0-9_]))";

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Hash)]
pub struct Flags {
    pub case_insensitive: bool,
    pub unicode: bool,
}

/// `new RegExp(source, 'm' + flags)`.
pub fn compile(source: &str, flags: Flags) -> Result<fancy_regex::Regex, String> {
    let mut pattern = String::from("(?m");
    if flags.case_insensitive {
        pattern.push('i');
    }
    pattern.push(')');
    pattern.push_str(&translate(source, flags)?);
    fancy_regex::RegexBuilder::new(&pattern)
        .backtrack_limit(10_000_000)
        .build()
        .map_err(|e| format!("{e} in /{source}/ (as {pattern})"))
}

fn chars(s: &str) -> Vec<char> {
    s.chars().collect()
}

fn hex_char(c: char) -> String {
    format!("\\x{{{:X}}}", c as u32)
}

/// A single literal character, safe anywhere in a Rust pattern (classes included).
fn literal(c: char) -> String {
    if c.is_ascii_alphanumeric() || c == '_' || (!c.is_ascii() && !c.is_whitespace()) {
        c.to_string()
    } else {
        hex_char(c)
    }
}

/// A parsed escape: a single character, or a class.
enum Escape {
    Char(char),
    /// Contents usable inside a Rust class (`0-9`), with a negated form usable as a nested class.
    Class { inner: String, negated: bool },
    /// `\p{..}` / `\P{..}`, passed through.
    Property(String),
}

/// Parses an escape at `s[i]` (just after the backslash). Returns the escape and the index after it.
fn parse_escape(s: &[char], i: usize, flags: Flags, in_class: bool) -> (Escape, usize) {
    let c = s[i];
    let class = |inner: &str, negated| Escape::Class { inner: inner.to_string(), negated };
    match c {
        'd' => (class("0-9", false), i + 1),
        'D' => (class("0-9", true), i + 1),
        'w' => (class(WORD, false), i + 1),
        'W' => (class(WORD, true), i + 1),
        's' => (class(JS_SPACE, false), i + 1),
        'S' => (class(JS_SPACE, true), i + 1),
        'n' => (Escape::Char('\n'), i + 1),
        'r' => (Escape::Char('\r'), i + 1),
        't' => (Escape::Char('\t'), i + 1),
        'f' => (Escape::Char('\x0C'), i + 1),
        'v' => (Escape::Char('\x0B'), i + 1),
        'b' if in_class => (Escape::Char('\x08'), i + 1),
        '0' if !s.get(i + 1).is_some_and(char::is_ascii_digit) => (Escape::Char('\0'), i + 1),
        'c' if s.get(i + 1).is_some_and(char::is_ascii_alphabetic) => {
            (Escape::Char(char::from_u32(s[i + 1] as u32 % 32).unwrap()), i + 2)
        }
        'x' if s.len() >= i + 3 && s[i + 1].is_ascii_hexdigit() && s[i + 2].is_ascii_hexdigit() => {
            let code: String = s[i + 1..i + 3].iter().collect();
            (Escape::Char(char::from_u32(u32::from_str_radix(&code, 16).unwrap()).unwrap()), i + 3)
        }
        'u' if flags.unicode && s.get(i + 1) == Some(&'{') => {
            let end = (i + 2..s.len()).find(|&j| s[j] == '}').unwrap_or(s.len());
            let code: String = s[i + 2..end].iter().collect();
            (Escape::Char(char::from_u32(u32::from_str_radix(&code, 16).unwrap_or(0)).unwrap_or('\0')), end + 1)
        }
        'u' if s.len() >= i + 5 && s[i + 1..i + 5].iter().all(char::is_ascii_hexdigit) => {
            let code: String = s[i + 1..i + 5].iter().collect();
            let unit = u32::from_str_radix(&code, 16).unwrap();
            (Escape::Char(char::from_u32(unit).unwrap_or('\u{FFFD}')), i + 5)
        }
        'p' | 'P' if flags.unicode && s.get(i + 1) == Some(&'{') => {
            let end = (i + 2..s.len()).find(|&j| s[j] == '}').unwrap_or(s.len());
            let body: String = s[i..=end.min(s.len() - 1)].iter().collect();
            (Escape::Property(format!("\\{body}")), end + 1)
        }
        other => (Escape::Char(other), i + 1),
    }
}

/// Translates a JavaScript character class starting at `s[i] == '['`. Returns the Rust pattern
/// and the index after the closing `]`.
fn translate_class(s: &[char], i: usize, flags: Flags) -> Result<(String, usize), String> {
    let mut j = i + 1;
    let negated = s.get(j) == Some(&'^');
    if negated {
        j += 1;
    }
    // Items: (single char) or class escape / property.
    enum Item {
        Char(char),
        Range(char, char),
        Raw(String),
    }
    let mut items: Vec<Item> = Vec::new();
    let read = |j: usize| -> Result<(Option<char>, Option<String>, usize), String> {
        match s.get(j) {
            None => Err("unterminated character class".into()),
            Some('\\') => {
                let (e, next) = parse_escape(s, j + 1, flags, true);
                Ok(match e {
                    Escape::Char(c) => (Some(c), None, next),
                    Escape::Class { inner, negated: false } => (None, Some(inner), next),
                    Escape::Class { inner, negated: true } => (None, Some(format!("[^{inner}]")), next),
                    Escape::Property(p) => (None, Some(p), next),
                })
            }
            Some(&c) => Ok((Some(c), None, j + 1)),
        }
    };
    loop {
        match s.get(j) {
            None => return Err("unterminated character class".into()),
            Some(']') => {
                j += 1;
                break;
            }
            _ => {}
        }
        let (c, raw, next) = read(j)?;
        j = next;
        match (c, raw) {
            (_, Some(raw)) => items.push(Item::Raw(raw)),
            (Some(c), None) => {
                // A range needs a single character on both sides (otherwise `-` is literal).
                if s.get(j) == Some(&'-') && s.get(j + 1).is_some_and(|&n| n != ']') {
                    let (hi, hi_raw, after) = read(j + 1)?;
                    if let (Some(hi), None) = (hi, &hi_raw) {
                        items.push(Item::Range(c, hi));
                        j = after;
                        continue;
                    }
                }
                items.push(Item::Char(c));
            }
            (None, None) => unreachable!(),
        }
    }
    if items.is_empty() {
        // `[]` never matches; `[^]` matches any character.
        return Ok((if negated { "(?s:.)".into() } else { "(?!(?s:.)?)".into() }, j));
    }
    let mut out = String::from("[");
    if negated {
        out.push('^');
    }
    for item in items {
        match item {
            Item::Char(c) => out.push_str(&hex_char(c)),
            Item::Range(a, b) => {
                let _ = write!(out, "{}-{}", hex_char(a), hex_char(b));
            }
            Item::Raw(r) => out.push_str(&r),
        }
    }
    out.push(']');
    Ok((out, j))
}

/// Whether `s[i..]` starts a valid quantifier `{n}`, `{n,}` or `{n,m}`.
fn quantifier_end(s: &[char], i: usize) -> Option<usize> {
    let mut j = i + 1;
    let digits = |j: &mut usize| {
        let start = *j;
        while s.get(*j).is_some_and(char::is_ascii_digit) {
            *j += 1;
        }
        *j > start
    };
    if !digits(&mut j) {
        return None;
    }
    if s.get(j) == Some(&',') {
        j += 1;
        digits(&mut j);
    }
    (s.get(j) == Some(&'}')).then_some(j + 1)
}

/// JavaScript regex source -> fancy-regex pattern.
pub fn translate(source: &str, flags: Flags) -> Result<String, String> {
    let s = chars(source);
    let mut out = String::with_capacity(source.len() * 2);
    let mut i = 0;
    while i < s.len() {
        let c = s[i];
        match c {
            '\\' => {
                let Some(&next) = s.get(i + 1) else { return Err("trailing backslash".into()) };
                match next {
                    'b' => {
                        out.push_str(BOUNDARY);
                        i += 2;
                    }
                    'B' => {
                        out.push_str(NOT_BOUNDARY);
                        i += 2;
                    }
                    '1'..='9' => {
                        let mut j = i + 1;
                        while s.get(j).is_some_and(char::is_ascii_digit) {
                            j += 1;
                        }
                        let n: String = s[i + 1..j].iter().collect();
                        let _ = write!(out, "\\{n}");
                        i = j;
                    }
                    'k' if s.get(i + 2) == Some(&'<') => {
                        let end = (i + 3..s.len()).find(|&j| s[j] == '>').ok_or("bad \\k")?;
                        let name: String = s[i + 3..end].iter().collect();
                        let _ = write!(out, "\\k<{name}>");
                        i = end + 1;
                    }
                    _ => {
                        let (e, after) = parse_escape(&s, i + 1, flags, false);
                        match e {
                            Escape::Char(c) => out.push_str(&literal(c)),
                            Escape::Class { inner, negated } => {
                                let _ = write!(out, "[{}{inner}]", if negated { "^" } else { "" });
                            }
                            Escape::Property(p) => out.push_str(&p),
                        }
                        i = after;
                    }
                }
            }
            '[' => {
                let (class, after) = translate_class(&s, i, flags)?;
                out.push_str(&class);
                i = after;
            }
            '(' => {
                // Group openers pass through: `(`, `(?:`, `(?=`, `(?!`, `(?<=`, `(?<!`, `(?<name>`.
                let opener_end = if s.get(i + 1) == Some(&'?') {
                    match (s.get(i + 2), s.get(i + 3)) {
                        (Some(':' | '=' | '!'), _) => i + 3,
                        (Some('<'), Some('=' | '!')) => i + 4,
                        (Some('<'), _) => (i + 3..s.len()).find(|&j| s[j] == '>').map(|j| j + 1).ok_or("bad group name")?,
                        _ => return Err("unsupported group".into()),
                    }
                } else {
                    i + 1
                };
                out.extend(&s[i..opener_end]);
                i = opener_end;
            }
            '{' => match quantifier_end(&s, i) {
                Some(end) => {
                    out.extend(&s[i..end]);
                    i = end;
                }
                None => {
                    out.push_str(r"\{");
                    i += 1;
                }
            },
            '}' => {
                out.push_str(r"\}");
                i += 1;
            }
            ')' | '|' | '^' | '$' | '.' | '*' | '+' | '?' => {
                out.push(c);
                i += 1;
            }
            other => {
                out.push_str(&literal(other));
                i += 1;
            }
        }
    }
    Ok(out)
}

/// One step of `BACKREF_RE` at `s[i]`: the length of the construct found there and what it is.
enum Construct {
    /// A character class, a non-capturing opener or an ordinary escape: copied as is.
    Other(usize),
    /// A capturing group opener (`(` or a named group).
    Capture(usize),
    /// A backreference `\N`.
    Backref(usize, usize),
}

fn construct_at(s: &[char], i: usize) -> Option<Construct> {
    match s[i] {
        // /\[(?:[^\\\]]|\\.)*\]/
        '[' => {
            let mut j = i + 1;
            while j < s.len() {
                match s[j] {
                    ']' => return Some(Construct::Other(j + 1 - i)),
                    '\\' if j + 1 < s.len() && s[j + 1] != '\n' => j += 2,
                    '\\' => return None,
                    _ => j += 1,
                }
            }
            None
        }
        '(' => {
            // /\(\?<(?![=!])[^>]+>/  and  /\(\?'[^']+'/
            if s.get(i + 1) == Some(&'?') {
                if s.get(i + 2) == Some(&'<') && !matches!(s.get(i + 3), Some('=' | '!')) {
                    let mut j = i + 3;
                    while j < s.len() && s[j] != '>' {
                        j += 1;
                    }
                    if j < s.len() && j > i + 3 {
                        return Some(Construct::Capture(j + 1 - i));
                    }
                }
                if s.get(i + 2) == Some(&'\'') {
                    let mut j = i + 3;
                    while j < s.len() && s[j] != '\'' {
                        j += 1;
                    }
                    if j < s.len() && j > i + 3 {
                        return Some(Construct::Capture(j + 1 - i));
                    }
                }
                // /\(\??/ matching "(?"
                return Some(Construct::Other(2));
            }
            Some(Construct::Capture(1))
        }
        '\\' => {
            // /\\([1-9][0-9]*)/ then /\\./
            if s.get(i + 1).is_some_and(|c| ('1'..='9').contains(c)) {
                let mut j = i + 2;
                while s.get(j).is_some_and(char::is_ascii_digit) {
                    j += 1;
                }
                let n: String = s[i + 1..j].iter().collect();
                return Some(Construct::Backref(j - i, n.parse().unwrap()));
            }
            if s.get(i + 1).is_some_and(|&c| c != '\n') {
                return Some(Construct::Other(2));
            }
            None
        }
        _ => None,
    }
}

/// `countMatchGroups`: capturing groups in a JS regex source.
pub fn count_groups(source: &str) -> usize {
    let s = chars(source);
    let (mut i, mut n) = (0, 0);
    while i < s.len() {
        match construct_at(&s, i) {
            Some(Construct::Capture(len)) => {
                n += 1;
                i += len;
            }
            Some(Construct::Other(len) | Construct::Backref(len, _)) => i += len,
            None => i += 1,
        }
    }
    n
}

/// `_rewriteBackreferences`: joins sources, each in its own group, renumbering backreferences.
pub fn rewrite_backreferences<S: AsRef<str>>(regexps: &[S], join_with: &str) -> String {
    let mut num_captures = 0;
    regexps
        .iter()
        .map(|regex| {
            num_captures += 1;
            let offset = num_captures;
            let s = chars(regex.as_ref());
            let mut out = String::new();
            let mut i = 0;
            while i < s.len() {
                match construct_at(&s, i) {
                    Some(Construct::Backref(len, n)) => {
                        let _ = write!(out, "\\{}", n + offset);
                        i += len;
                    }
                    Some(Construct::Capture(len)) => {
                        out.extend(&s[i..i + len]);
                        num_captures += 1;
                        i += len;
                    }
                    Some(Construct::Other(len)) => {
                        out.extend(&s[i..i + len]);
                        i += len;
                    }
                    None => {
                        out.push(s[i]);
                        i += 1;
                    }
                }
            }
            format!("({out})")
        })
        .collect::<Vec<_>>()
        .join(join_with)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn re(s: &str) -> fancy_regex::Regex {
        compile(s, Flags::default()).unwrap()
    }

    #[test]
    fn js_semantics() {
        assert!(re(r"\bé").is_match("aé").unwrap(), "ASCII word boundary");
        assert!(!re(r"\w").is_match("é").unwrap());
        assert!(re(r"a{").is_match("a{").unwrap(), "literal brace");
        assert!(re(r"[[]").is_match("[").unwrap(), "literal [ in class");
        assert!(re(r"[a-]").is_match("-").unwrap());
        assert!(re(r"[\w-]").is_match("-").unwrap());
        assert!(re(r"x{2}").is_match("xx").unwrap());
        assert_eq!(count_groups(r"(a)(?:b)(?<n>c)[(]\("), 2);
        assert_eq!(rewrite_backreferences(&[r"(a)\1", r"(b)\1"], "|"), r"((a)\2)|((b)\4)");
    }
}
