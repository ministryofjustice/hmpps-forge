//! Tokenization of the **inside** of a `{% … %}` tag (after the template lexer produced [`crate::lexer::Token::Tag`]).
//!
//! Use [`tokenize_tag_body`] to split a trimmed tag string into keywords and other tokens for control-flow parsing.

use crate::errors::{Result, RunjucksError};

/// Control-flow and statement keywords inside Nunjucks-style tags.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TagKeyword {
    If,
    Elif,
    ElseIf,
    Else,
    EndIf,
    For,
    In,
    EndFor,
    AsyncEach,
    EndEach,
    AsyncAll,
    EndAll,
    Block,
    EndBlock,
    IfAsync,
    Extends,
    Include,
    Set,
    EndSet,
    Macro,
    EndMacro,
    Call,
    EndCall,
    Import,
    From,
    Filter,
    EndFilter,
    Switch,
    Case,
    Default,
    EndSwitch,
    Raw,
    EndRaw,
    Verbatim,
    EndVerbatim,
}

fn keyword_from_ident(ident: &str) -> Option<TagKeyword> {
    Some(match ident {
        "if" => TagKeyword::If,
        "elif" => TagKeyword::Elif,
        "elseif" => TagKeyword::ElseIf,
        "else" => TagKeyword::Else,
        "endif" => TagKeyword::EndIf,
        "for" => TagKeyword::For,
        "in" => TagKeyword::In,
        "endfor" => TagKeyword::EndFor,
        "asyncEach" => TagKeyword::AsyncEach,
        "endeach" => TagKeyword::EndEach,
        "asyncAll" => TagKeyword::AsyncAll,
        "endall" => TagKeyword::EndAll,
        "block" => TagKeyword::Block,
        "endblock" => TagKeyword::EndBlock,
        "ifAsync" => TagKeyword::IfAsync,
        "extends" => TagKeyword::Extends,
        "include" => TagKeyword::Include,
        "set" => TagKeyword::Set,
        "endset" => TagKeyword::EndSet,
        "macro" => TagKeyword::Macro,
        "endmacro" => TagKeyword::EndMacro,
        "call" => TagKeyword::Call,
        "endcall" => TagKeyword::EndCall,
        "import" => TagKeyword::Import,
        "from" => TagKeyword::From,
        "filter" => TagKeyword::Filter,
        "endfilter" => TagKeyword::EndFilter,
        "switch" => TagKeyword::Switch,
        "case" => TagKeyword::Case,
        "default" => TagKeyword::Default,
        "endswitch" => TagKeyword::EndSwitch,
        "raw" => TagKeyword::Raw,
        "endraw" => TagKeyword::EndRaw,
        "verbatim" => TagKeyword::Verbatim,
        "endverbatim" => TagKeyword::EndVerbatim,
        _ => return None,
    })
}

/// A single token inside a tag body.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TagToken {
    /// Statement keyword (`if`, `for`, `endfor`, …).
    Keyword(TagKeyword),
    /// Identifier or other unquoted word (not a keyword).
    Ident(String),
    /// Double-quoted string (contents without quotes).
    String(String),
    /// Any other single-byte punctuation (`,`, `(`, `)`, `=`, …).
    Punct(char),
}

fn skip_ws(s: &str) -> &str {
    s.trim_start_matches(|c: char| c.is_whitespace())
}

fn take_ident(s: &str) -> Option<(&str, &str)> {
    let s = skip_ws(s);
    let mut chars = s.char_indices();
    let (start, first) = chars.next()?;
    if !(first.is_ascii_alphabetic() || first == '_') {
        return None;
    }
    let mut end = start + first.len_utf8();
    for (i, c) in chars {
        if c.is_ascii_alphanumeric() || c == '_' {
            end = i + c.len_utf8();
        } else {
            break;
        }
    }
    Some((&s[start..end], &s[end..]))
}

fn take_string(s: &str) -> Result<(&str, &str)> {
    let s = skip_ws(s);
    let rest = s
        .strip_prefix('"')
        .ok_or_else(|| RunjucksError::new("expected string literal"))?;
    let mut escaped = false;
    for (i, c) in rest.char_indices() {
        if escaped {
            escaped = false;
            continue;
        }
        if c == '\\' {
            escaped = true;
            continue;
        }
        if c == '"' {
            return Ok((&rest[..i], &rest[i + 1..]));
        }
    }
    Err(RunjucksError::new("unclosed string in tag"))
}

/// Tokenizes a tag inner string (e.g. from [`crate::lexer::Token::Tag`]) for statement parsing.
///
/// # Errors
///
/// Returns an error on unclosed string literals.
///
/// # Examples
///
/// ```
/// use runjucks_core::tag_lex::{tokenize_tag_body, TagKeyword, TagToken};
///
/// let t = tokenize_tag_body("if cond").unwrap();
/// assert_eq!(t[0], TagToken::Keyword(TagKeyword::If));
/// assert_eq!(t[1], TagToken::Ident("cond".into()));
/// ```
pub fn tokenize_tag_body(input: &str) -> Result<Vec<TagToken>> {
    let mut out = Vec::new();
    let mut s = input.trim();
    while !s.is_empty() {
        s = skip_ws(s);
        if s.is_empty() {
            break;
        }
        if s.starts_with('"') {
            let (inner, rest) = take_string(s)?;
            out.push(TagToken::String(inner.to_string()));
            s = rest;
            continue;
        }
        if let Some((ident, rest)) = take_ident(s) {
            let tok = if let Some(kw) = keyword_from_ident(ident) {
                TagToken::Keyword(kw)
            } else {
                TagToken::Ident(ident.to_string())
            };
            out.push(tok);
            s = rest;
            continue;
        }
        let c = s.chars().next().unwrap();
        out.push(TagToken::Punct(c));
        s = &s[c.len_utf8()..];
    }
    Ok(out)
}
