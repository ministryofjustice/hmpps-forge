//! Expression parsing for `{{ … }}` bodies (Nunjucks-style precedence).
//!
//! Reference: `nunjucks/nunjucks/src/parser.js` (`parseExpression` → `parseOr` → … → `parsePrimary`).

use crate::ast::{BinOp, CompareOp, Expr, MacroParam, UnaryOp};
use crate::errors::{Result, RunjucksError};
use crate::parser::split::split_top_level_commas;
use nom::branch::alt;
use nom::character::complete::{char, digit1};
use nom::combinator::{all_consuming, map_res, opt, recognize};
use nom::IResult;
use nom::Parser;
use serde_json::{json, Value};

/// Keyword arguments in a `foo(a, b, k=v)` call.
type CallKwArgs = Vec<(String, Expr)>;
/// Positional and keyword pieces of a `foo(a, b, k=v)` call.
type CallArgParts = (Vec<Expr>, CallKwArgs);

fn trim_start(s: &str) -> &str {
    s.trim_start()
}

/// True if `s` has a full ASCII keyword of length `kw_len` at the start (not a prefix of a longer identifier).
fn keyword_boundary(s: &str, kw_len: usize) -> bool {
    s.as_bytes()
        .get(kw_len)
        .is_none_or(|&b| !b.is_ascii_alphanumeric() && b != b'_')
}

fn parse_keyword<'a>(input: &'a str, kw: &str) -> Option<&'a str> {
    let input = trim_start(input);
    if input.starts_with(kw) && keyword_boundary(input, kw.len()) {
        Some(&input[kw.len()..])
    } else {
        None
    }
}

fn parse_string(input: &str) -> IResult<&str, String> {
    let input = trim_start(input);
    let mut chars = input.chars();
    let quote = match chars.next() {
        Some('"') => '"',
        Some('\'') => '\'',
        _ => {
            return Err(nom::Err::Error(nom::error::Error::new(
                input,
                nom::error::ErrorKind::Tag,
            )));
        }
    };
    let rest = &input[quote.len_utf8()..];
    let mut out = String::new();
    let mut i = 0usize;
    let rest_bytes = rest.as_bytes();
    while i < rest_bytes.len() {
        let c = rest[i..].chars().next().unwrap();
        if c == quote {
            return Ok((&rest[i + c.len_utf8()..], out));
        }
        if c == '\\' {
            i += 1;
            let Some(esc) = rest.get(i..).and_then(|s| s.chars().next()) else {
                return Err(nom::Err::Failure(nom::error::Error::new(
                    input,
                    nom::error::ErrorKind::Escaped,
                )));
            };
            match esc {
                'n' => out.push('\n'),
                'r' => out.push('\r'),
                't' => out.push('\t'),
                '\\' => out.push('\\'),
                q if q == quote => out.push(q),
                _ => out.push(esc),
            }
            i += esc.len_utf8();
            continue;
        }
        out.push(c);
        i += c.len_utf8();
    }
    Err(nom::Err::Failure(nom::error::Error::new(
        input,
        nom::error::ErrorKind::Tag,
    )))
}

fn parse_number(input: &str) -> IResult<&str, Value> {
    let input = trim_start(input);
    map_res(
        recognize((
            opt(char('-')),
            alt((recognize((digit1, char('.'), digit1)), digit1)),
        )),
        |s: &str| -> std::result::Result<Value, ()> {
            if s.contains('.') {
                s.parse::<f64>().map(|x| json!(x)).map_err(|_| ())
            } else if let Ok(n) = s.parse::<i64>() {
                Ok(json!(n))
            } else {
                s.parse::<f64>().map(|x| json!(x)).map_err(|_| ())
            }
        },
    )
    .parse(input)
}

fn parse_bool_or_none(input: &str) -> IResult<&str, Value> {
    let input = trim_start(input);
    if input.starts_with("true") && keyword_boundary(input, 4) {
        return Ok((&input[4..], json!(true)));
    }
    if input.starts_with("false") && keyword_boundary(input, 5) {
        return Ok((&input[5..], json!(false)));
    }
    if input.starts_with("none") && keyword_boundary(input, 4) {
        return Ok((&input[4..], Value::Null));
    }
    if input.starts_with("null") && keyword_boundary(input, 4) {
        return Ok((&input[4..], Value::Null));
    }
    Err(nom::Err::Error(nom::error::Error::new(
        input,
        nom::error::ErrorKind::Tag,
    )))
}

fn parse_identifier(input: &str) -> IResult<&str, String> {
    let input = trim_start(input);
    let mut chars = input.chars();
    let first = match chars.next() {
        Some(c) if c.is_ascii_alphabetic() || c == '_' => c,
        _ => {
            return Err(nom::Err::Error(nom::error::Error::new(
                input,
                nom::error::ErrorKind::Tag,
            )));
        }
    };
    let len_first = first.len_utf8();
    let take = input[len_first..]
        .chars()
        .take_while(|c| c.is_ascii_alphanumeric() || *c == '_')
        .map(|c| c.len_utf8())
        .sum::<usize>();
    let end = len_first + take;
    Ok((&input[end..], input[..end].to_string()))
}

/// `ident` or `foo.bar` filter names (Nunjucks [`parseFilterName`](https://github.com/mozilla/nunjucks/blob/master/nunjucks/src/parser.js)).
fn parse_filter_name(input: &str) -> IResult<&str, String> {
    let (mut rest, mut name) = parse_identifier(input)?;
    loop {
        let r = trim_start(rest);
        if let Some(r2) = r.strip_prefix('.') {
            let (r3, part) = parse_identifier(trim_start(r2))?;
            name.push('.');
            name.push_str(&part);
            rest = r3;
        } else {
            break;
        }
    }
    Ok((rest, name))
}

fn simple_ident_str(s: &str) -> bool {
    let mut ch = s.chars();
    let Some(first) = ch.next() else {
        return false;
    };
    if !first.is_ascii_alphabetic() && first != '_' {
        return false;
    }
    ch.all(|c| c.is_ascii_alphanumeric() || c == '_')
}

/// If `seg` is `name = expr` at depth 0 (not `==`), returns `(name, expr source)`.
fn split_call_kw_seg(seg: &str) -> Option<(&str, &str)> {
    let seg = seg.trim();
    let bytes = seg.as_bytes();
    let mut depth = 0i32;
    let mut in_string: Option<u8> = None;
    let mut escaped = false;
    let mut i = 0usize;
    while i < bytes.len() {
        let c = bytes[i];
        if let Some(q) = in_string {
            if escaped {
                escaped = false;
                i += 1;
                continue;
            }
            if c == b'\\' {
                escaped = true;
                i += 1;
                continue;
            }
            if c == q {
                in_string = None;
            }
            i += 1;
            continue;
        }
        if c == b'"' || c == b'\'' {
            in_string = Some(c);
            i += 1;
            continue;
        }
        match c {
            b'(' => depth += 1,
            b')' => depth -= 1,
            b'=' if depth == 0 => {
                if i + 1 < bytes.len() && bytes[i + 1] == b'=' {
                    i += 2;
                    continue;
                }
                if i > 0 && bytes[i - 1] == b'=' {
                    i += 1;
                    continue;
                }
                let left = seg[..i].trim();
                let right = seg[i + 1..].trim();
                if simple_ident_str(left) {
                    return Some((left, right));
                }
            }
            _ => {}
        }
        i += 1;
    }
    None
}

/// After `(` of a call, splits at the matching `)` and returns `(rest_after_close, inner)`.
fn split_call_inner_rest(rest_after_open_paren: &str) -> IResult<&str, &str> {
    let s = trim_start(rest_after_open_paren);
    let bytes = s.as_bytes();
    let mut depth = 0i32;
    let mut in_string: Option<u8> = None;
    let mut escaped = false;
    let mut i = 0usize;
    while i < bytes.len() {
        let c = bytes[i];
        if let Some(q) = in_string {
            if escaped {
                escaped = false;
                i += 1;
                continue;
            }
            if c == b'\\' {
                escaped = true;
                i += 1;
                continue;
            }
            if c == q {
                in_string = None;
            }
            i += 1;
            continue;
        }
        if c == b'"' || c == b'\'' {
            in_string = Some(c);
            i += 1;
            continue;
        }
        match c {
            b'(' => depth += 1,
            b')' if depth == 0 => {
                return Ok((&s[i + 1..], &s[..i]));
            }
            b')' => depth -= 1,
            _ => {}
        }
        i += 1;
    }
    Err(nom::Err::Failure(nom::error::Error::new(
        s,
        nom::error::ErrorKind::Tag,
    )))
}

fn parse_call_argument_list_inner(inner: &str) -> Result<CallArgParts> {
    let inner = inner.trim();
    if inner.is_empty() {
        return Ok((vec![], vec![]));
    }
    let segs = split_top_level_commas(inner);
    let mut pos = Vec::new();
    let mut kw = Vec::new();
    for seg in segs {
        let seg = seg.trim();
        if seg.is_empty() {
            continue;
        }
        if let Some((name, rhs)) = split_call_kw_seg(seg) {
            kw.push((name.to_string(), parse_expression(rhs)?));
        } else {
            pos.push(parse_expression(seg)?);
        }
    }
    Ok((pos, kw))
}

fn parse_call_argument_list(input: &str) -> IResult<&str, CallArgParts> {
    let input = trim_start(input);
    if let Some(r) = input.strip_prefix(')') {
        return Ok((r, (vec![], vec![])));
    }
    let (rest, inner) = split_call_inner_rest(input)?;
    match parse_call_argument_list_inner(inner) {
        Ok(pair) => Ok((rest, pair)),
        Err(_) => Err(nom::Err::Failure(nom::error::Error::new(
            inner,
            nom::error::ErrorKind::Verify,
        ))),
    }
}

/// Index of the closing `]` for subscript content (caller has already consumed the opening `[`).
fn bracket_content_end(s: &str) -> Option<usize> {
    let mut depth = 0i32;
    for (i, c) in s.char_indices() {
        match c {
            '[' => depth += 1,
            ']' => {
                if depth == 0 {
                    return Some(i);
                }
                depth -= 1;
            }
            _ => {}
        }
    }
    None
}

fn has_top_level_colon(body: &str) -> bool {
    let mut d_paren = 0i32;
    let mut d_bracket = 0i32;
    for c in body.chars() {
        match c {
            '(' => d_paren += 1,
            ')' => d_paren -= 1,
            '[' => d_bracket += 1,
            ']' => d_bracket -= 1,
            ':' if d_paren == 0 && d_bracket == 0 => return true,
            _ => {}
        }
    }
    false
}

fn split_top_level_colon(body: &str) -> Vec<&str> {
    let mut parts = Vec::new();
    let mut start = 0usize;
    let mut d_paren = 0i32;
    let mut d_bracket = 0i32;
    for (i, c) in body.char_indices() {
        match c {
            '(' => d_paren += 1,
            ')' => d_paren -= 1,
            '[' => d_bracket += 1,
            ']' => d_bracket -= 1,
            ':' if d_paren == 0 && d_bracket == 0 => {
                parts.push(body[start..i].trim());
                start = i + 1;
            }
            _ => {}
        }
    }
    parts.push(body[start..].trim());
    parts
}

fn parse_optional_slice_segment(
    seg: &str,
) -> std::result::Result<Option<Expr>, nom::Err<nom::error::Error<&str>>> {
    let seg = seg.trim();
    if seg.is_empty() {
        return Ok(None);
    }
    all_consuming(parse_inline_if)
        .parse(seg)
        .map(|(_, e)| Some(e))
}

fn parse_subscript(input: &str) -> IResult<&str, Expr> {
    let end = bracket_content_end(input).ok_or_else(|| {
        nom::Err::Failure(nom::error::Error::new(input, nom::error::ErrorKind::Tag))
    })?;
    let body = trim_start(&input[..end]);
    let rest = &input[end + 1..];

    if !has_top_level_colon(body) {
        let (_, e) = all_consuming(parse_inline_if).parse(body)?;
        return Ok((rest, e));
    }

    let segs = split_top_level_colon(body);
    if segs.len() > 3 {
        return Err(nom::Err::Failure(nom::error::Error::new(
            body,
            nom::error::ErrorKind::TooLarge,
        )));
    }
    let start_e = parse_optional_slice_segment(segs.first().copied().unwrap_or(""))?;
    let stop_e = parse_optional_slice_segment(segs.get(1).copied().unwrap_or(""))?;
    let step_e = parse_optional_slice_segment(segs.get(2).copied().unwrap_or(""))?;
    let start = start_e.map(Box::new);
    let stop = stop_e.map(Box::new);
    let step = step_e.map(Box::new);
    Ok((rest, Expr::Slice { start, stop, step }))
}

fn parse_postfix(input: &str, mut node: Expr) -> IResult<&str, Expr> {
    let mut rest = input;
    loop {
        let r = trim_start(rest);
        if let Some(r2) = r.strip_prefix('.') {
            let (r3, attr) = parse_identifier(trim_start(r2))?;
            node = Expr::GetAttr {
                base: Box::new(node),
                attr,
            };
            rest = r3;
            continue;
        }
        if let Some(r2) = r.strip_prefix('[') {
            let (r4, idx) = parse_subscript(trim_start(r2))?;
            node = Expr::GetItem {
                base: Box::new(node),
                index: Box::new(idx),
            };
            rest = r4;
            continue;
        }
        if let Some(r2) = r.strip_prefix('(') {
            let (r3, (args, kwargs)) = parse_call_argument_list(r2)?;
            node = Expr::Call {
                callee: Box::new(node),
                args,
                kwargs,
            };
            rest = r3;
            continue;
        }
        break;
    }
    Ok((rest, node))
}

fn parse_list_literal(input: &str) -> IResult<&str, Expr> {
    let input = trim_start(input);
    let after = input.strip_prefix('[').ok_or_else(|| {
        nom::Err::Error(nom::error::Error::new(input, nom::error::ErrorKind::Tag))
    })?;
    let mut rest = trim_start(after);
    if let Some(r) = rest.strip_prefix(']') {
        return Ok((r, Expr::List(vec![])));
    }
    let mut items = Vec::new();
    loop {
        let (r, e) = parse_inline_if(rest)?;
        items.push(e);
        let r = trim_start(r);
        if let Some(r2) = r.strip_prefix(']') {
            return Ok((r2, Expr::List(items)));
        }
        let r = r.strip_prefix(',').ok_or_else(|| {
            nom::Err::Failure(nom::error::Error::new(r, nom::error::ErrorKind::Tag))
        })?;
        rest = trim_start(r);
    }
}

fn parse_dict_literal(input: &str) -> IResult<&str, Expr> {
    let input = trim_start(input);
    let after = input.strip_prefix('{').ok_or_else(|| {
        nom::Err::Error(nom::error::Error::new(input, nom::error::ErrorKind::Tag))
    })?;
    let mut rest = trim_start(after);
    if let Some(r) = rest.strip_prefix('}') {
        return Ok((r, Expr::Dict(vec![])));
    }
    let mut pairs = Vec::new();
    loop {
        let (r, k) = parse_inline_if(rest)?;
        // Nunjucks treats a bare identifier key (`{ value: x }`) as the string `"value"`.
        let k = match k {
            Expr::Variable(name) => Expr::Literal(Value::String(name)),
            other => other,
        };
        let r = trim_start(r);
        let r = r.strip_prefix(':').ok_or_else(|| {
            nom::Err::Failure(nom::error::Error::new(r, nom::error::ErrorKind::Tag))
        })?;
        let (r, v) = parse_inline_if(trim_start(r))?;
        pairs.push((k, v));
        let r = trim_start(r);
        if let Some(r2) = r.strip_prefix('}') {
            return Ok((r2, Expr::Dict(pairs)));
        }
        let r = r.strip_prefix(',').ok_or_else(|| {
            nom::Err::Failure(nom::error::Error::new(r, nom::error::ErrorKind::Tag))
        })?;
        rest = trim_start(r);
    }
}

fn parse_atom(input: &str) -> IResult<&str, Expr> {
    let input = trim_start(input);
    if let Some(after) = input.strip_prefix('(') {
        let (rest, e) = parse_inline_if(after)?;
        let rest = trim_start(rest);
        let r = rest.strip_prefix(')').ok_or_else(|| {
            nom::Err::Failure(nom::error::Error::new(rest, nom::error::ErrorKind::Tag))
        })?;
        return Ok((r, e));
    }
    if input.starts_with('[') {
        return parse_list_literal(input);
    }
    if input.starts_with('{') {
        return parse_dict_literal(input);
    }
    if let Ok((rest, v)) = parse_string(input) {
        return Ok((rest, Expr::Literal(json!(v))));
    }
    if let Ok((rest, v)) = parse_bool_or_none(input) {
        return Ok((rest, Expr::Literal(v)));
    }
    if let Ok((rest, v)) = parse_number(input) {
        return Ok((rest, Expr::Literal(v)));
    }
    if let Ok((rest, rx)) = parse_regex_literal(input) {
        return Ok((rest, rx));
    }
    let (rest, name) = parse_identifier(input)?;
    Ok((rest, Expr::Variable(name)))
}

/// `r/pattern/flags` — see [Nunjucks lexer](https://github.com/mozilla/nunjucks/blob/master/nunjucks/src/lexer.js).
fn parse_regex_literal(input: &str) -> IResult<&str, Expr> {
    let input = trim_start(input);
    let Some(after_r_slash) = input.strip_prefix("r/") else {
        return Err(nom::Err::Error(nom::error::Error::new(
            input,
            nom::error::ErrorKind::Tag,
        )));
    };
    let mut prev = None::<char>;
    let mut body = String::new();
    let mut end_slash = None::<usize>;
    for (i, c) in after_r_slash.char_indices() {
        if c == '/' && prev != Some('\\') {
            end_slash = Some(i);
            break;
        }
        body.push(c);
        prev = Some(c);
    }
    let end_idx = end_slash.ok_or_else(|| {
        nom::Err::Failure(nom::error::Error::new(input, nom::error::ErrorKind::Eof))
    })?;
    let after_slash = &after_r_slash[end_idx + 1..];
    let mut flags = String::new();
    for ch in after_slash.chars() {
        if matches!(ch, 'g' | 'i' | 'm' | 'y') {
            flags.push(ch);
        } else {
            break;
        }
    }
    let rest = &after_slash[flags.len()..];
    Ok((
        rest,
        Expr::RegexLiteral {
            pattern: body,
            flags,
        },
    ))
}

fn parse_atom_with_postfix(input: &str) -> IResult<&str, Expr> {
    let (rest, atom) = parse_atom(input)?;
    parse_postfix(rest, atom)
}

fn parse_filter_chain(input: &str, mut node: Expr) -> IResult<&str, Expr> {
    let mut rest = input;
    loop {
        let r = trim_start(rest);
        if !r.starts_with('|') {
            break;
        }
        let after = &r[1..];
        let after = trim_start(after);
        let (r2, name) = parse_filter_name(after)?;
        let after_name = trim_start(r2);
        let (r3, (extra_args, filter_kw)) = if let Some(inner) = after_name.strip_prefix('(') {
            parse_call_argument_list(inner)?
        } else {
            (after_name, (vec![], vec![]))
        };
        if !filter_kw.is_empty() {
            return Err(nom::Err::Failure(nom::error::Error::new(
                after_name,
                nom::error::ErrorKind::Verify,
            )));
        }
        node = Expr::Filter {
            name,
            input: Box::new(node),
            args: extra_args,
        };
        rest = r3;
    }
    Ok((rest, node))
}

fn parse_unary_no_filters(input: &str) -> IResult<&str, Expr> {
    let t = trim_start(input);
    if let Some(rest) = parse_keyword(t, "not") {
        let (rest, e) = parse_unary_no_filters(rest)?;
        return Ok((
            rest,
            Expr::Unary {
                op: UnaryOp::Not,
                expr: Box::new(e),
            },
        ));
    }
    if t.starts_with('-')
        && t.as_bytes()
            .get(1)
            .is_some_and(|b| b.is_ascii_digit() || *b == b'.')
    {
        let (rest, v) = parse_number(t)?;
        return Ok((rest, Expr::Literal(v)));
    }
    if let Some(rest) = t.strip_prefix('-') {
        let (rest, e) = parse_unary_no_filters(rest)?;
        return Ok((
            rest,
            Expr::Unary {
                op: UnaryOp::Neg,
                expr: Box::new(e),
            },
        ));
    }
    if let Some(rest) = t.strip_prefix('+') {
        let (rest, e) = parse_unary_no_filters(rest)?;
        return Ok((
            rest,
            Expr::Unary {
                op: UnaryOp::Pos,
                expr: Box::new(e),
            },
        ));
    }
    parse_atom_with_postfix(input)
}

fn parse_unary(input: &str) -> IResult<&str, Expr> {
    let (rest, e) = parse_unary_no_filters(input)?;
    parse_filter_chain(rest, e)
}

fn parse_pow(input: &str) -> IResult<&str, Expr> {
    let (mut rest, mut acc) = parse_unary(input)?;
    loop {
        let r = trim_start(rest);
        if let Some(r2) = r.strip_prefix("**") {
            rest = r2;
            let (r2, rhs) = parse_unary(rest)?;
            rest = r2;
            acc = Expr::Binary {
                op: BinOp::Pow,
                left: Box::new(acc),
                right: Box::new(rhs),
            };
            continue;
        }
        break;
    }
    Ok((rest, acc))
}

fn parse_mod(input: &str) -> IResult<&str, Expr> {
    let (mut rest, mut acc) = parse_pow(input)?;
    loop {
        let r = trim_start(rest);
        if let Some(r2) = r.strip_prefix('%') {
            if r2.starts_with('%') {
                break;
            }
            let (r3, rhs) = parse_pow(r2)?;
            rest = r3;
            acc = Expr::Binary {
                op: BinOp::Mod,
                left: Box::new(acc),
                right: Box::new(rhs),
            };
            continue;
        }
        break;
    }
    Ok((rest, acc))
}

fn parse_floor_div(input: &str) -> IResult<&str, Expr> {
    let (mut rest, mut acc) = parse_mod(input)?;
    loop {
        let r = trim_start(rest);
        if let Some(r2) = r.strip_prefix("//") {
            let (r3, rhs) = parse_mod(r2)?;
            rest = r3;
            acc = Expr::Binary {
                op: BinOp::FloorDiv,
                left: Box::new(acc),
                right: Box::new(rhs),
            };
            continue;
        }
        break;
    }
    Ok((rest, acc))
}

fn parse_div(input: &str) -> IResult<&str, Expr> {
    let (mut rest, mut acc) = parse_floor_div(input)?;
    loop {
        let r = trim_start(rest);
        if let Some(r2) = r.strip_prefix('/') {
            if r2.starts_with('/') {
                break;
            }
            let (r3, rhs) = parse_floor_div(r2)?;
            rest = r3;
            acc = Expr::Binary {
                op: BinOp::Div,
                left: Box::new(acc),
                right: Box::new(rhs),
            };
            continue;
        }
        break;
    }
    Ok((rest, acc))
}

fn parse_mul(input: &str) -> IResult<&str, Expr> {
    let (mut rest, mut acc) = parse_div(input)?;
    loop {
        let r = trim_start(rest);
        if let Some(r2) = r.strip_prefix('*') {
            if r2.starts_with('*') {
                break;
            }
            let (r3, rhs) = parse_div(r2)?;
            rest = r3;
            acc = Expr::Binary {
                op: BinOp::Mul,
                left: Box::new(acc),
                right: Box::new(rhs),
            };
            continue;
        }
        break;
    }
    Ok((rest, acc))
}

fn parse_sub(input: &str) -> IResult<&str, Expr> {
    let (mut rest, mut acc) = parse_mul(input)?;
    loop {
        let r = trim_start(rest);
        if let Some(r2) = r.strip_prefix('-') {
            let (r3, rhs) = parse_mul(r2)?;
            rest = r3;
            acc = Expr::Binary {
                op: BinOp::Sub,
                left: Box::new(acc),
                right: Box::new(rhs),
            };
            continue;
        }
        break;
    }
    Ok((rest, acc))
}

fn parse_add(input: &str) -> IResult<&str, Expr> {
    let (mut rest, mut acc) = parse_sub(input)?;
    loop {
        let r = trim_start(rest);
        if let Some(r2) = r.strip_prefix('+') {
            let (r3, rhs) = parse_sub(r2)?;
            rest = r3;
            acc = Expr::Binary {
                op: BinOp::Add,
                left: Box::new(acc),
                right: Box::new(rhs),
            };
            continue;
        }
        break;
    }
    Ok((rest, acc))
}

fn parse_concat(input: &str) -> IResult<&str, Expr> {
    let (mut rest, mut acc) = parse_add(input)?;
    loop {
        let r = trim_start(rest);
        if let Some(r2) = r.strip_prefix('~') {
            let (r3, rhs) = parse_add(r2)?;
            rest = r3;
            acc = Expr::Binary {
                op: BinOp::Concat,
                left: Box::new(acc),
                right: Box::new(rhs),
            };
            continue;
        }
        break;
    }
    Ok((rest, acc))
}

fn parse_compare_op(rest: &str) -> Option<(CompareOp, usize)> {
    if rest.starts_with("===") {
        Some((CompareOp::StrictEq, 3))
    } else if rest.starts_with("!==") {
        Some((CompareOp::StrictNe, 3))
    } else if rest.starts_with("==") {
        Some((CompareOp::Eq, 2))
    } else if rest.starts_with("!=") {
        Some((CompareOp::Ne, 2))
    } else if rest.starts_with("<=") {
        Some((CompareOp::Le, 2))
    } else if rest.starts_with(">=") {
        Some((CompareOp::Ge, 2))
    } else if rest.starts_with('<') {
        Some((CompareOp::Lt, 1))
    } else if rest.starts_with('>') {
        Some((CompareOp::Gt, 1))
    } else {
        None
    }
}

fn parse_compare(input: &str) -> IResult<&str, Expr> {
    let (mut rest, head) = parse_concat(input)?;
    let mut rest_vec: Vec<(CompareOp, Expr)> = Vec::new();
    loop {
        let r = trim_start(rest);
        if let Some((op, len)) = parse_compare_op(r) {
            let after = &r[len..];
            let (r2, rhs) = parse_concat(after)?;
            rest = r2;
            rest_vec.push((op, rhs));
            continue;
        }
        break;
    }
    if rest_vec.is_empty() {
        Ok((rest, head))
    } else {
        Ok((
            rest,
            Expr::Compare {
                head: Box::new(head),
                rest: rest_vec,
            },
        ))
    }
}

fn parse_is(input: &str) -> IResult<&str, Expr> {
    let (mut rest, mut acc) = parse_compare(input)?;
    loop {
        let r = trim_start(rest);
        if let Some(r2) = parse_keyword(r, "is") {
            let mut after = trim_start(r2);
            let mut negated = false;
            if let Some(r3) = parse_keyword(after, "not") {
                negated = true;
                after = trim_start(r3);
            }
            let (r3, rhs) = parse_compare(after)?;
            rest = r3;
            let node = Expr::Binary {
                op: BinOp::Is,
                left: Box::new(acc),
                right: Box::new(rhs),
            };
            acc = if negated {
                Expr::Unary {
                    op: UnaryOp::Not,
                    expr: Box::new(node),
                }
            } else {
                node
            };
            continue;
        }
        break;
    }
    Ok((rest, acc))
}

fn parse_in(input: &str) -> IResult<&str, Expr> {
    let (mut rest, mut acc) = parse_is(input)?;
    loop {
        let r = trim_start(rest);
        let (invert, after_not) = if let Some(r2) = parse_keyword(r, "not") {
            let r3 = trim_start(r2);
            if let Some(r4) = parse_keyword(r3, "in") {
                (true, r4)
            } else {
                break;
            }
        } else if let Some(r2) = parse_keyword(r, "in") {
            (false, r2)
        } else {
            break;
        };
        let (r2, rhs) = parse_is(after_not)?;
        rest = r2;
        let mut node = Expr::Binary {
            op: BinOp::In,
            left: Box::new(acc),
            right: Box::new(rhs),
        };
        if invert {
            node = Expr::Unary {
                op: UnaryOp::Not,
                expr: Box::new(node),
            };
        }
        acc = node;
    }
    Ok((rest, acc))
}

/// Nunjucks `parseNot`: `not` binds looser than `in`, `is` and comparisons, so `not "a" in b` is
/// `not ("a" in b)`.
fn parse_not(input: &str) -> IResult<&str, Expr> {
    let t = trim_start(input);
    if let Some(rest) = parse_keyword(t, "not") {
        let (rest, e) = parse_not(rest)?;
        return Ok((
            rest,
            Expr::Unary {
                op: UnaryOp::Not,
                expr: Box::new(e),
            },
        ));
    }
    parse_in(input)
}

fn parse_and(input: &str) -> IResult<&str, Expr> {
    let (mut rest, mut acc) = parse_not(input)?;
    loop {
        let r = trim_start(rest);
        if let Some(r2) = parse_keyword(r, "and") {
            let (r3, rhs) = parse_not(r2)?;
            rest = r3;
            acc = Expr::Binary {
                op: BinOp::And,
                left: Box::new(acc),
                right: Box::new(rhs),
            };
            continue;
        }
        break;
    }
    Ok((rest, acc))
}

fn parse_or(input: &str) -> IResult<&str, Expr> {
    let (mut rest, mut acc) = parse_and(input)?;
    loop {
        let r = trim_start(rest);
        if let Some(r2) = parse_keyword(r, "or") {
            let (r3, rhs) = parse_and(r2)?;
            rest = r3;
            acc = Expr::Binary {
                op: BinOp::Or,
                left: Box::new(acc),
                right: Box::new(rhs),
            };
            continue;
        }
        break;
    }
    Ok((rest, acc))
}

pub(crate) fn parse_macro_param_segment(seg: &str) -> Result<MacroParam> {
    let seg = seg.trim();
    if seg.is_empty() {
        return Err(RunjucksError::new("empty macro parameter"));
    }
    if let Some((name, rhs)) = split_call_kw_seg(seg) {
        Ok(MacroParam {
            name: name.to_string(),
            default: Some(parse_expression(rhs)?),
        })
    } else if simple_ident_str(seg) {
        Ok(MacroParam {
            name: seg.to_string(),
            default: None,
        })
    } else {
        Err(RunjucksError::new(format!(
            "invalid macro parameter `{seg}` (expected `name` or `name = default`)"
        )))
    }
}

pub(crate) fn parse_inline_if(input: &str) -> IResult<&str, Expr> {
    let (rest, first) = parse_or(input)?;
    let r = trim_start(rest);
    if let Some(r2) = parse_keyword(r, "if") {
        let (r3, cond) = parse_or(r2)?;
        let r3 = trim_start(r3);
        let (rest, else_expr) = if let Some(r4) = parse_keyword(r3, "else") {
            let (r5, e) = parse_or(r4)?;
            (r5, Some(e))
        } else {
            (r3, None)
        };
        return Ok((
            rest,
            Expr::InlineIf {
                cond: Box::new(cond),
                then_expr: Box::new(first),
                else_expr: else_expr.map(Box::new),
            },
        ));
    }
    Ok((rest, first))
}

/// Parses a full `{{ … }}` body (must consume all non-whitespace).
pub fn parse_expression(source: &str) -> Result<Expr> {
    let s = source.trim();
    if s.is_empty() {
        return Err(RunjucksError::new(
            "empty expression inside `{{ }}` is not allowed",
        ));
    }
    match all_consuming(parse_inline_if).parse(s) {
        Ok((_, expr)) => Ok(expr),
        Err(e) => Err(RunjucksError::new(format!("expression parse error: {e}"))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ast::BinOp;

    #[test]
    fn precedence_mul_before_add() {
        let e = parse_expression("2 + 3 * 4").unwrap();
        match e {
            Expr::Binary {
                op: BinOp::Add,
                left,
                right,
            } => {
                assert!(matches!(*left, Expr::Literal(_)));
                assert!(matches!(*right, Expr::Binary { op: BinOp::Mul, .. }));
            }
            _ => panic!("unexpected {:?}", e),
        }
    }
}
