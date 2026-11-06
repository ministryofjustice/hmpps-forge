//! Output filters applied during render (e.g. HTML escaping when [`crate::Environment::autoescape`] is on).

use crate::environment::Environment;
use crate::errors::{Result, RunjucksError};
use crate::js_regex::compile_js_regex;
use crate::value::{
    is_marked_safe, is_undefined_value, mark_safe, regexp_pattern_flags, value_to_string,
    value_to_string_raw,
};
use rand::Rng;
use regex::Regex;
use serde_json::{json, Map, Value};
use std::sync::OnceLock;

/// Escapes a string for safe insertion into HTML text.
pub fn escape_html(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&#39;"),
            _ => out.push(c),
        }
    }
    out
}

/// Same encoding as Nunjucks `| escape` filter (entities + backslash).
fn escape_filter_body(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&#39;"),
            '\\' => out.push_str("&#92;"),
            _ => out.push(c),
        }
    }
    out
}

/// Nunjucks-style `| escape`: HTML entities plus backslash as `&#92;`.
pub fn escape_filter_value(v: &Value) -> Value {
    Value::String(escape_filter_body(&value_to_string_raw(v)))
}

fn js_style_round(x: f64, precision: i64) -> f64 {
    if precision == 0 {
        if x.is_sign_negative() {
            -((-x) + 0.5).floor()
        } else {
            (x + 0.5).floor()
        }
    } else {
        let m = 10_f64.powi(precision as i32);
        js_style_round(x * m, 0) / m
    }
}

fn as_f64_arg(v: &Value) -> Option<f64> {
    v.as_f64().or_else(|| value_to_string(v).parse().ok())
}

fn striptags_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"(?i)<\/?([a-z][a-z0-9]*)\b[^>]*>|<!--[\s\S]*?-->").unwrap())
}

fn word_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"\w+").unwrap())
}

fn encode_uri_component(s: &str) -> String {
    let mut out = String::new();
    for c in s.chars() {
        let mut buf = [0u8; 4];
        for byte in c.encode_utf8(&mut buf).as_bytes() {
            match *byte {
                b'A'..=b'Z'
                | b'a'..=b'z'
                | b'0'..=b'9'
                | b'-'
                | b'_'
                | b'.'
                | b'!'
                | b'~'
                | b'*'
                | b'\''
                | b'('
                | b')' => out.push(char::from(*byte)),
                _ => out.push_str(&format!("%{:02x}", byte)),
            }
        }
    }
    out
}

fn get_attr_value(v: &Value, attr: &str) -> Value {
    if attr.is_empty() {
        return v.clone();
    }
    let mut cur = v;
    for part in attr.split('.') {
        match cur {
            Value::Object(o) => {
                cur = o.get(part).unwrap_or(&Value::Null);
            }
            _ => return Value::Null,
        }
    }
    cur.clone()
}

fn filter_default(input: &Value, args: &[Value]) -> Value {
    let def = args.first().cloned().unwrap_or(Value::Null);
    let use_or = args.get(1).and_then(|v| v.as_bool()).unwrap_or(false);

    if use_or {
        if is_undefined_value(input)
            || input.is_null()
            || matches!(input, Value::Bool(false))
            || (matches!(input, Value::String(s) if s.is_empty()))
            || input.as_f64().is_some_and(|x| x == 0.0 && !x.is_nan())
        {
            def
        } else {
            input.clone()
        }
    } else if is_undefined_value(input) {
        def
    } else {
        input.clone()
    }
}

fn filter_batch(input: &Value, args: &[Value]) -> Result<Value> {
    let Some(Value::Array(arr)) = Some(input) else {
        return Ok(Value::Array(vec![]));
    };
    let linecount = args
        .first()
        .and_then(|a| {
            a.as_u64()
                .or_else(|| value_to_string(a).parse().ok().map(|n: u64| n))
        })
        .ok_or_else(|| RunjucksError::new("`batch` filter needs a positive chunk size"))?;
    if linecount == 0 {
        return Err(RunjucksError::new("`batch` chunk size must be positive"));
    }
    let linecount = linecount as usize;
    let fill_with = args
        .get(1)
        .cloned()
        .filter(|v| !v.is_null() && !is_undefined_value(v));

    let mut res: Vec<Value> = Vec::new();
    let mut tmp: Vec<Value> = Vec::new();

    for (i, item) in arr.iter().enumerate() {
        if i % linecount == 0 && !tmp.is_empty() {
            res.push(Value::Array(std::mem::take(&mut tmp)));
        }
        tmp.push(item.clone());
    }

    if !tmp.is_empty() {
        if let Some(fill) = fill_with {
            for _ in tmp.len()..linecount {
                tmp.push(fill.clone());
            }
        }
        res.push(Value::Array(tmp));
    }

    Ok(Value::Array(res))
}

fn filter_first(input: &Value) -> Value {
    match input {
        Value::Array(a) => a.first().cloned().unwrap_or(Value::Null),
        _ => Value::Null,
    }
}

fn filter_last(input: &Value) -> Value {
    match input {
        Value::Array(a) => a.last().cloned().unwrap_or(Value::Null),
        _ => Value::Null,
    }
}

fn filter_reverse(input: &Value) -> Value {
    match input {
        Value::String(s) => Value::String(s.chars().rev().collect()),
        Value::Array(a) => {
            let mut v = a.clone();
            v.reverse();
            Value::Array(v)
        }
        _ => input.clone(),
    }
}

/// First character uppercased, remainder lowercased (matches `apply_builtin` `capitalize`).
pub(crate) fn capitalize_string_slice(s: &str) -> String {
    let mut it = s.chars();
    if let Some(c) = it.next() {
        format!(
            "{}{}",
            c.to_uppercase().collect::<String>(),
            it.as_str().to_lowercase()
        )
    } else {
        String::new()
    }
}

/// Built-in `capitalize` for fused chains (same as `apply_builtin` `capitalize`).
pub(crate) fn chain_capitalize_like_builtin(input: &Value) -> Value {
    Value::String(capitalize_string_slice(&value_to_string(input)))
}

/// Built-in `trim` body; shared with fused filter chains in [`crate::renderer`].
pub(crate) fn chain_trim_like_builtin(input: &Value) -> Value {
    Value::String(
        value_to_string_raw(input)
            .trim_matches(|c: char| c.is_whitespace())
            .to_string(),
    )
}

fn filter_trim(input: &Value) -> Value {
    chain_trim_like_builtin(input)
}

fn filter_sum(input: &Value, args: &[Value]) -> Result<Value> {
    let Value::Array(arr) = input else {
        return Ok(json!(0));
    };
    let (attr_opt, start): (Option<String>, f64) = match args.len() {
        0 => (None, 0.0),
        1 => {
            if let Some(f) = as_f64_arg(&args[0]) {
                (None, f)
            } else {
                (Some(value_to_string(&args[0])), 0.0)
            }
        }
        _ => (
            Some(value_to_string(&args[0])),
            as_f64_arg(&args[1]).unwrap_or(0.0),
        ),
    };

    let mapped: Vec<Value> = if let Some(ref key) = attr_opt {
        arr.iter().map(|v| get_attr_value(v, key)).collect()
    } else {
        arr.clone()
    };

    let sum: f64 = mapped.iter().filter_map(as_f64_arg).sum();
    let total = start + sum;
    Ok(
        if total.fract() == 0.0 && total >= i64::MIN as f64 && total <= i64::MAX as f64 {
            json!(total as i64)
        } else {
            json!(total)
        },
    )
}

fn filter_wordcount(input: &Value) -> Value {
    let s = value_to_string_raw(input);
    let n = word_re().find_iter(&s).count();
    json!(n)
}

fn filter_nl2br(input: &Value) -> Value {
    let s = value_to_string_raw(input);
    let out = Regex::new(r"\r\n|\n")
        .unwrap()
        .replace_all(&s, "<br />\n")
        .to_string();
    Value::String(out)
}

fn filter_indent(input: &Value, args: &[Value]) -> Value {
    let s = value_to_string_raw(input);
    if s.is_empty() {
        return Value::String(String::new());
    }
    let width = args
        .first()
        .and_then(|a| a.as_u64().or_else(|| value_to_string(a).parse().ok()))
        .unwrap_or(4) as usize;
    let indent_first = args
        .get(1)
        .map(|v| v.as_bool().unwrap_or(!value_to_string(v).is_empty()))
        .unwrap_or(false);

    let sp = " ".repeat(width);
    let lines: Vec<&str> = s.split('\n').collect();
    let mut res = String::new();
    for (i, line) in lines.iter().enumerate() {
        if i > 0 {
            res.push('\n');
        }
        if i == 0 && !indent_first {
            res.push_str(line);
        } else {
            res.push_str(&sp);
            res.push_str(line);
        }
    }
    Value::String(res)
}

fn capitalize_word(word: &str) -> String {
    let mut it = word.chars();
    match it.next() {
        None => String::new(),
        Some(c) => {
            let head: String = c.to_uppercase().collect();
            let tail: String = it.as_str().to_lowercase();
            format!("{head}{tail}")
        }
    }
}

fn filter_title(input: &Value) -> Value {
    let s = value_to_string_raw(input);
    let out = s
        .split(' ')
        .map(capitalize_word)
        .collect::<Vec<_>>()
        .join(" ");
    Value::String(out)
}

fn filter_truncate(input: &Value, args: &[Value]) -> Value {
    let s = value_to_string_raw(input);
    let length = args
        .first()
        .and_then(|a| a.as_u64().or_else(|| value_to_string(a).parse().ok()))
        .unwrap_or(255) as usize;
    if s.chars().count() <= length {
        return Value::String(s.into_owned());
    }
    let killwords = args
        .get(1)
        .map(|v| v.as_bool().unwrap_or(false))
        .unwrap_or(false);
    let end = args
        .get(2)
        .map(value_to_string)
        .unwrap_or_else(|| "...".to_string());

    let out: String = if killwords {
        s.chars().take(length).collect()
    } else {
        let prefix: String = s.chars().take(length + 1).collect();
        match prefix.rfind(' ') {
            Some(i) if i > 0 => prefix.chars().take(i).collect(),
            _ => s.chars().take(length).collect(),
        }
    };
    Value::String(format!("{out}{end}"))
}

/// Matches Nunjucks `filters.js` `striptags` (including `preserveLinebreaks`).
fn filter_striptags(input: &Value, args: &[Value]) -> Value {
    let s = value_to_string_raw(input);
    let stripped = striptags_re().replace_all(&s, "");
    let trimmed_input = stripped.trim();
    let preserve = args
        .first()
        .map(|v| v.as_bool().unwrap_or(false))
        .unwrap_or(false);
    let res = if preserve {
        striptags_preserve_linebreaks_nunjucks(trimmed_input)
    } else {
        striptags_collapse_whitespace_nunjucks(trimmed_input)
    };
    Value::String(res)
}

fn striptags_collapse_whitespace_nunjucks(s: &str) -> String {
    static RE: OnceLock<Regex> = OnceLock::new();
    let re = RE.get_or_init(|| Regex::new(r"\s+").unwrap());
    re.replace_all(s, " ").into_owned()
}

fn striptags_preserve_linebreaks_nunjucks(s: &str) -> String {
    static RE_LINE_EDGES: OnceLock<Regex> = OnceLock::new();
    static RE_SPACES: OnceLock<Regex> = OnceLock::new();
    static RE_EXTRA_NEWLINES: OnceLock<Regex> = OnceLock::new();
    let re_line = RE_LINE_EDGES.get_or_init(|| Regex::new(r"(?m)^ +| +$").unwrap());
    let re_spaces = RE_SPACES.get_or_init(|| Regex::new(r" +").unwrap());
    let re_nl = RE_EXTRA_NEWLINES.get_or_init(|| Regex::new(r"\n\n\n+").unwrap());
    let mut res = re_line.replace_all(s, "").into_owned();
    res = re_spaces.replace_all(&res, " ").into_owned();
    res = res.replace("\r\n", "\n");
    re_nl.replace_all(&res, "\n\n").into_owned()
}

fn filter_urlencode(input: &Value, _args: &[Value]) -> Value {
    match input {
        Value::String(s) => Value::String(encode_uri_component(s)),
        Value::Array(pairs) => {
            let mut parts = Vec::new();
            for p in pairs {
                match p {
                    Value::Array(kv) if kv.len() >= 2 => {
                        let k = encode_uri_component(&value_to_string(&kv[0]));
                        let v = encode_uri_component(&value_to_string(&kv[1]));
                        parts.push(format!("{k}={v}"));
                    }
                    _ => {}
                }
            }
            Value::String(parts.join("&"))
        }
        Value::Object(o) => {
            let mut keys: Vec<&String> = o.keys().collect();
            keys.sort();
            let parts: Vec<String> = keys
                .into_iter()
                .map(|k| {
                    format!(
                        "{}={}",
                        encode_uri_component(k),
                        encode_uri_component(&value_to_string(o.get(k).unwrap_or(&Value::Null)))
                    )
                })
                .collect();
            Value::String(parts.join("&"))
        }
        _ => Value::String(String::new()),
    }
}

fn filter_string(input: &Value) -> Value {
    if is_marked_safe(input) {
        input.clone()
    } else {
        Value::String(value_to_string(input))
    }
}

fn filter_float(input: &Value, args: &[Value]) -> Value {
    let def = args.first().cloned().unwrap_or(Value::Null);
    let s = value_to_string_raw(input);
    let res: f64 = s.parse().unwrap_or(f64::NAN);
    if res.is_nan() {
        def
    } else if res.fract() == 0.0 && res >= i64::MIN as f64 && res <= i64::MAX as f64 {
        json!(res as i64)
    } else {
        json!(res)
    }
}

fn filter_int(input: &Value, args: &[Value]) -> Value {
    let default_val = args.first().cloned().unwrap_or(Value::Null);
    let base = args
        .get(1)
        .and_then(|a| {
            a.as_u64()
                .or_else(|| value_to_string(a).parse().ok().map(|n: u64| n))
        })
        .unwrap_or(10) as u32;

    let s = value_to_string_raw(input).trim().to_string();
    let parsed = if base == 10 {
        s.parse::<i64>().ok()
    } else {
        i64::from_str_radix(&s, base).ok()
    };
    match parsed {
        Some(n) => json!(n),
        None => default_val,
    }
}

fn filter_sort(input: &Value, args: &[Value]) -> Result<Value> {
    let Value::Array(arr) = input else {
        return Ok(Value::Array(vec![]));
    };
    let reversed = args
        .first()
        .map(|v| v.as_bool().unwrap_or(false))
        .unwrap_or(false);
    let case_sensitive = args
        .get(1)
        .map(|v| v.as_bool().unwrap_or(false))
        .unwrap_or(false);
    let attr = args.get(2).map(value_to_string).unwrap_or_default();

    let mut keys: Vec<Vec<Value>> = arr
        .iter()
        .map(|item| {
            let key = if attr.is_empty() {
                item.clone()
            } else {
                get_attr_value(item, &attr)
            };
            vec![key, item.clone()]
        })
        .collect();

    keys.sort_by(|a, b| {
        let x = &a[0];
        let y = &b[0];
        let mut ord = compare_sort_keys(x, y, case_sensitive);
        if reversed {
            ord = ord.reverse();
        }
        ord
    });

    Ok(Value::Array(
        keys.into_iter().map(|p| p[1].clone()).collect(),
    ))
}

fn compare_sort_keys(a: &Value, b: &Value, case_sensitive: bool) -> std::cmp::Ordering {
    let (mut sa, mut sb) = (value_to_string(a), value_to_string(b));
    if !case_sensitive {
        sa = sa.to_lowercase();
        sb = sb.to_lowercase();
    }
    partial_cmp_str(&sa, &sb)
}

fn partial_cmp_str(a: &str, b: &str) -> std::cmp::Ordering {
    match (a.parse::<f64>(), b.parse::<f64>()) {
        (Ok(x), Ok(y)) if !x.is_nan() && !y.is_nan() => {
            x.partial_cmp(&y).unwrap_or(std::cmp::Ordering::Equal)
        }
        _ => a.cmp(b),
    }
}

fn filter_dictsort(input: &Value, args: &[Value]) -> Result<Value> {
    let Value::Object(o) = input else {
        return Ok(Value::Array(vec![]));
    };
    let case_sensitive = args
        .first()
        .map(|v| v.as_bool().unwrap_or(false))
        .unwrap_or(false);
    let by_value = args
        .get(1)
        .map(|v| value_to_string(v) == "value")
        .unwrap_or(false);

    let mut pairs: Vec<(String, Value)> = o.iter().map(|(k, v)| (k.clone(), v.clone())).collect();

    pairs.sort_by(|(k1, v1), (k2, v2)| {
        if by_value {
            compare_sort_keys(v1, v2, case_sensitive)
        } else {
            let (mut a, mut b) = (k1.clone(), k2.clone());
            if !case_sensitive {
                a = a.to_lowercase();
                b = b.to_lowercase();
            }
            a.cmp(&b)
        }
    });

    let out: Vec<Value> = pairs
        .into_iter()
        .map(|(k, v)| Value::Array(vec![Value::String(k), v]))
        .collect();
    Ok(Value::Array(out))
}

fn filter_center(input: &Value, args: &[Value]) -> Value {
    let s = value_to_string_raw(input);
    let width = args
        .first()
        .and_then(|a| a.as_u64().or_else(|| value_to_string(a).parse().ok()))
        .unwrap_or(80) as usize;
    let len = s.chars().count();
    if len >= width {
        return Value::String(s.into_owned());
    }
    let spaces = width - len;
    let pre = spaces / 2;
    let post = spaces - pre;
    let sp_pre = " ".repeat(pre);
    let sp_post = " ".repeat(post);
    Value::String(format!("{sp_pre}{s}{sp_post}"))
}

fn filter_dump(input: &Value, args: &[Value]) -> Value {
    let spaces = args
        .first()
        .and_then(|a| a.as_u64().or_else(|| value_to_string(a).parse().ok()))
        .unwrap_or(0) as usize;
    let s = if spaces == 0 {
        serde_json::to_string(input).unwrap_or_default()
    } else {
        serde_json::to_string_pretty(input).unwrap_or_default()
    };
    Value::String(s)
}

fn filter_list(input: &Value) -> Result<Value> {
    match input {
        Value::String(s) => Ok(Value::Array(
            s.chars().map(|c| Value::String(c.to_string())).collect(),
        )),
        Value::Array(a) => Ok(Value::Array(a.clone())),
        Value::Object(o) => {
            let mut keys: Vec<&String> = o.keys().collect();
            keys.sort();
            let out: Vec<Value> = keys
                .into_iter()
                .map(|k| {
                    json!({
                        "key": k,
                        "value": o.get(k).cloned().unwrap_or(Value::Null)
                    })
                })
                .collect();
            Ok(Value::Array(out))
        }
        _ => Err(RunjucksError::new(
            "`list` filter expects string, array, or object",
        )),
    }
}

fn filter_slice_(input: &Value, args: &[Value]) -> Result<Value> {
    let Value::Array(arr) = input else {
        return Ok(Value::Array(vec![]));
    };
    let slices = args
        .first()
        .and_then(|a| a.as_u64().or_else(|| value_to_string(a).parse().ok()))
        .ok_or_else(|| RunjucksError::new("`slice` filter needs number of slices"))?;
    if slices == 0 {
        return Ok(Value::Array(vec![]));
    }
    let slices = slices as usize;
    let n = arr.len();
    let slice_length = n / slices;
    let extra = n % slices;
    let fill = args.get(1).cloned();

    let mut res: Vec<Value> = Vec::new();
    let mut offset = 0_usize;
    for i in 0..slices {
        let start = offset + i * slice_length;
        if i < extra {
            offset += 1;
        }
        let end = offset + (i + 1) * slice_length;
        let mut cur: Vec<Value> = arr.get(start..end).unwrap_or(&[]).to_vec();
        if fill.is_some() && i >= extra {
            if let Some(ref f) = fill {
                cur.push(f.clone());
            }
        }
        res.push(Value::Array(cur));
    }
    Ok(Value::Array(res))
}

fn filter_selectattr(input: &Value, args: &[Value]) -> Value {
    let attr = args.first().map(value_to_string).unwrap_or_default();
    let Value::Array(arr) = input else {
        return Value::Array(vec![]);
    };
    let out: Vec<Value> = arr
        .iter()
        .filter(|item| is_truthy_filter(&get_attr_value(item, &attr)))
        .cloned()
        .collect();
    Value::Array(out)
}

fn filter_rejectattr(input: &Value, args: &[Value]) -> Value {
    let attr = args.first().map(value_to_string).unwrap_or_default();
    let Value::Array(arr) = input else {
        return Value::Array(vec![]);
    };
    let out: Vec<Value> = arr
        .iter()
        .filter(|item| !is_truthy_filter(&get_attr_value(item, &attr)))
        .cloned()
        .collect();
    Value::Array(out)
}

fn is_truthy_filter(v: &Value) -> bool {
    !matches!(v, Value::Null | Value::Bool(false))
        && !(matches!(v, Value::String(s) if s.is_empty()))
        && !is_undefined_value(v)
        && !v.as_f64().is_some_and(|x| x == 0.0 || x.is_nan())
}

fn filter_select(env: &Environment, input: &Value, args: &[Value]) -> Result<Value> {
    let test_name = args
        .first()
        .map(value_to_string)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| RunjucksError::new("`select` filter expects a test name"))?;
    let test_args = &args[1..];
    let Value::Array(items) = input else {
        return Ok(Value::Array(vec![]));
    };
    let mut out = Vec::new();
    for item in items {
        if env.apply_is_test(&test_name, item, test_args)? {
            out.push(item.clone());
        }
    }
    Ok(Value::Array(out))
}

fn filter_reject(env: &Environment, input: &Value, args: &[Value]) -> Result<Value> {
    let test_name = args
        .first()
        .map(value_to_string)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| RunjucksError::new("`reject` filter expects a test name"))?;
    let test_args = &args[1..];
    let Value::Array(items) = input else {
        return Ok(Value::Array(vec![]));
    };
    let mut out = Vec::new();
    for item in items {
        if !env.apply_is_test(&test_name, item, test_args)? {
            out.push(item.clone());
        }
    }
    Ok(Value::Array(out))
}

fn filter_groupby(input: &Value, args: &[Value]) -> Result<Value> {
    let attr = args
        .first()
        .map(value_to_string)
        .ok_or_else(|| RunjucksError::new("`groupby` filter needs an attribute name"))?;
    let Value::Array(arr) = input else {
        return Ok(Value::Object(Map::new()));
    };
    let mut map: Map<String, Value> = Map::new();
    for item in arr {
        let key_v = get_attr_value(item, &attr);
        let key = value_to_string(&key_v);
        map.entry(key)
            .and_modify(|e| {
                if let Value::Array(a) = e {
                    a.push(item.clone());
                }
            })
            .or_insert_with(|| Value::Array(vec![item.clone()]));
    }
    Ok(Value::Object(map))
}

fn filter_urlize(input: &Value, args: &[Value]) -> Value {
    let s = value_to_string_raw(input);
    let len = args
        .first()
        .and_then(|a| {
            if a.is_null() || is_undefined_value(a) {
                None
            } else {
                a.as_u64().or_else(|| value_to_string(a).parse().ok())
            }
        })
        .unwrap_or(u64::MAX) as usize;
    let nofollow = args.get(1).and_then(|v| v.as_bool()).unwrap_or(false);
    let nf = if nofollow { r#" rel="nofollow""# } else { "" };

    let punc_re = Regex::new(r"^(?:\(|<|&lt;)?(.*?)(?:\.|,|\)|\n|&gt;)?$").unwrap();
    let email_re = Regex::new(r"^[\w.!#$%&'*+\-/=?\^`{|}~]+@[a-z\d\-]+(\.[a-z\d\-]+)+$").unwrap();
    let http_re = Regex::new(r"^https?://.*$").unwrap();
    let www_re = Regex::new(r"^www\.").unwrap();
    let tld_re = Regex::new(r"\.(?:org|net|com)(?:\:|\/|$)").unwrap();

    let tok_re = Regex::new(r"\S+|\s+").unwrap();
    let mut out = String::new();
    for m in tok_re.find_iter(&s) {
        let word = m.as_str();
        if word.chars().all(|c| c.is_whitespace()) {
            out.push_str(word);
            continue;
        }
        let mat = punc_re.captures(word);
        let possible = mat
            .as_ref()
            .and_then(|c| c.get(1))
            .map(|m| m.as_str())
            .unwrap_or(word);
        let short: String = possible.chars().take(len).collect();

        let linked = if http_re.is_match(possible) {
            format!(r#"<a href="{possible}"{nf}>{short}</a>"#)
        } else if www_re.is_match(possible) {
            format!(r#"<a href="http://{possible}"{nf}>{short}</a>"#)
        } else if email_re.is_match(possible) {
            format!(r#"<a href="mailto:{possible}">{possible}</a>"#)
        } else if tld_re.is_match(possible) {
            format!(r#"<a href="http://{possible}"{nf}>{short}</a>"#)
        } else {
            word.to_string()
        };
        out.push_str(&linked);
    }
    Value::String(out)
}

/// Nunjucks `replace` (literal substring, optional max count, empty-needle split behavior).
fn filter_replace_nunjucks(input: &Value, args: &[Value]) -> Result<Value> {
    let from_v = args
        .first()
        .ok_or_else(|| RunjucksError::new("replace filter needs from string"))?;
    enum ReplaceNeedle {
        Literal(String),
        Regex { re: Regex, global: bool },
    }
    let needle = if let Some((pattern, flags)) = regexp_pattern_flags(from_v) {
        ReplaceNeedle::Regex {
            re: compile_js_regex(&pattern, &flags)?,
            global: flags.contains('g'),
        }
    } else {
        match from_v {
            Value::String(s) => ReplaceNeedle::Literal(s.clone()),
            Value::Number(_) => ReplaceNeedle::Literal(value_to_string(from_v)),
            _ => {
                return Ok(input.clone());
            }
        }
    };
    let to = args.get(1).map(value_to_string).unwrap_or_default();
    let max_count = args
        .get(2)
        .and_then(|v| {
            v.as_i64()
                .or_else(|| value_to_string(v).parse().ok())
                .or_else(|| v.as_f64().map(|x| x as i64))
        })
        .unwrap_or(-1_i64);
    let max_rep = if max_count < 0 {
        usize::MAX
    } else {
        max_count as usize
    };

    let hay = match input {
        Value::String(s) => s.clone(),
        Value::Number(_) => value_to_string(input),
        _ if is_marked_safe(input) => value_to_string_raw(input).into_owned(),
        _ => {
            return Ok(input.clone());
        }
    };

    fn copy_safeness(input: &Value, s: String) -> Value {
        if is_marked_safe(input) {
            mark_safe(s)
        } else {
            Value::String(s)
        }
    }

    match needle {
        ReplaceNeedle::Literal(from) => {
            if from.is_empty() {
                // Nunjucks / Python: `new + chars.join(new) + new` (no separator before the first char).
                let chs: Vec<char> = hay.chars().collect();
                let mut res = to.clone();
                for (i, ch) in chs.iter().enumerate() {
                    res.push(*ch);
                    if i + 1 < chs.len() {
                        res.push_str(&to);
                    }
                }
                res.push_str(&to);
                return Ok(copy_safeness(input, res));
            }

            let mut pos = 0usize;
            let mut count = 0usize;
            let mut next = hay.find(&from);
            if max_rep == 0 || next.is_none() {
                return Ok(copy_safeness(input, hay));
            }
            let mut out = String::new();
            while let Some(idx) = next {
                if count >= max_rep {
                    break;
                }
                out.push_str(&hay[pos..idx]);
                out.push_str(&to);
                pos = idx + from.len();
                count += 1;
                next = hay[pos..].find(&from).map(|i| i + pos);
            }
            if pos < hay.len() {
                out.push_str(&hay[pos..]);
            }
            Ok(copy_safeness(input, out))
        }
        ReplaceNeedle::Regex { re, global } => {
            let limit = if global { max_rep } else { max_rep.min(1) };
            if limit == 0 {
                return Ok(copy_safeness(input, hay));
            }
            let mut out = String::new();
            let mut last = 0usize;
            let mut count = 0usize;
            for m in re.find_iter(&hay) {
                if count >= limit {
                    break;
                }
                out.push_str(&hay[last..m.start()]);
                out.push_str(&to);
                last = m.end();
                count += 1;
            }
            if count == 0 {
                return Ok(copy_safeness(input, hay));
            }
            if last < hay.len() {
                out.push_str(&hay[last..]);
            }
            Ok(copy_safeness(input, out))
        }
    }
}

/// Applies a filter (`name`) to `input` with extra `args` (Nunjucks-style).
///
/// Resolves user filters from [`Environment`] first; built-ins are used when no custom filter matches.
pub fn apply_builtin(
    env: &Environment,
    rng: &mut impl Rng,
    name: &str,
    input: &Value,
    args: &[Value],
) -> Result<Value> {
    if let Some(f) = env.custom_filters.get(name) {
        return f(input, args);
    }
    match name {
        "upper" => Ok(keep_safeness(input, Value::String(value_to_string(input).to_uppercase()))),
        "lower" => Ok(keep_safeness(input, Value::String(value_to_string(input).to_lowercase()))),
        "length" => match input {
            Value::String(s) => Ok(json!(s.chars().count())),
            Value::Array(a) => Ok(json!(a.len())),
            v if is_undefined_value(v) => Ok(json!(0)),
            v if crate::value::is_marked_safe(v) => Ok(json!(crate::value::value_to_string(v).chars().count())),
            Value::Object(o) => Ok(json!(o.len())),
            _ => Ok(json!(0)),
        },
        "join" => {
            let sep = args.first().map(value_to_string).unwrap_or_default();
            let attr = args.get(1).map(value_to_string);
            let Value::Array(items) = input else {
                return Ok(Value::String(String::new()));
            };
            let mut s = String::new();
            for (i, it) in items.iter().enumerate() {
                if i > 0 {
                    s.push_str(&sep);
                }
                let piece = if let Some(ref a) = attr {
                    get_attr_value(it, a)
                } else {
                    it.clone()
                };
                s.push_str(&value_to_string(&piece));
            }
            Ok(Value::String(s))
        }
        "replace" => filter_replace_nunjucks(input, args),
        "random" => {
            let Value::Array(arr) = input else {
                return Ok(Value::Null);
            };
            if arr.is_empty() {
                return Ok(Value::Null);
            }
            let idx = rng.gen_range(0..arr.len());
            Ok(arr[idx].clone())
        }
        "round" => {
            let n = as_f64_arg(input)
                .ok_or_else(|| RunjucksError::new("round filter expects a number"))?;
            let prec = args
                .first()
                .and_then(|a| a.as_i64().or_else(|| value_to_string(a).parse().ok()))
                .unwrap_or(0_i64);
            let method = args.get(1).map(value_to_string).unwrap_or_default();
            let factor = 10_f64.powi(prec as i32);
            let r = match method.as_str() {
                "ceil" => (n * factor).ceil() / factor,
                "floor" => (n * factor).floor() / factor,
                _ => js_style_round(n, prec),
            };
            Ok(
                if r.fract() == 0.0 && r >= i64::MIN as f64 && r <= i64::MAX as f64 {
                    json!(r as i64)
                } else {
                    json!(r)
                },
            )
        }
        "escape" | "e" => {
            if is_marked_safe(input) {
                return Ok(input.clone());
            }
            let out = escape_filter_body(&value_to_string_raw(input));
            Ok(mark_safe(out))
        }
        "safe" => Ok(mark_safe(value_to_string(input))),
        "forceescape" => {
            let out = escape_filter_body(&value_to_string_raw(input));
            Ok(mark_safe(out))
        }
        "default" | "d" => Ok(filter_default(input, args)),
        "batch" => filter_batch(input, args),
        "first" => Ok(filter_first(input)),
        "last" => Ok(filter_last(input)),
        "reverse" => Ok(filter_reverse(input)),
        "trim" => Ok(keep_safeness(input, filter_trim(input))),
        "sum" => filter_sum(input, args),
        "wordcount" => Ok(filter_wordcount(input)),
        "nl2br" => Ok(filter_nl2br(input)),
        "indent" => Ok(keep_safeness(input, filter_indent(input, args))),
        "title" => Ok(keep_safeness(input, filter_title(input))),
        "truncate" => Ok(keep_safeness(input, filter_truncate(input, args))),
        "striptags" => Ok(filter_striptags(input, args)),
        "urlencode" => Ok(filter_urlencode(input, args)),
        "string" => Ok(filter_string(input)),
        "float" => Ok(filter_float(input, args)),
        "int" => Ok(filter_int(input, args)),
        "sort" => filter_sort(input, args),
        "dictsort" => filter_dictsort(input, args),
        "center" => Ok(keep_safeness(input, filter_center(input, args))),
        "dump" => Ok(filter_dump(input, args)),
        "list" => filter_list(input),
        "slice" => filter_slice_(input, args),
        "urlize" => Ok(filter_urlize(input, args)),
        "selectattr" => Ok(filter_selectattr(input, args)),
        "rejectattr" => Ok(filter_rejectattr(input, args)),
        "select" => filter_select(env, input, args),
        "reject" => filter_reject(env, input, args),
        "groupby" => filter_groupby(input, args),
        "abs" => {
            let n = as_f64_arg(input)
                .ok_or_else(|| RunjucksError::new("abs filter expects a number"))?;
            let a = n.abs();
            Ok(
                if a.fract() == 0.0 && a >= i64::MIN as f64 && a <= i64::MAX as f64 {
                    json!(a as i64)
                } else {
                    json!(a)
                },
            )
        }
        "capitalize" => Ok(keep_safeness(input, chain_capitalize_like_builtin(input))),
        _ => Err(RunjucksError::new(format!("unknown filter `{name}`"))),
    }
}

/// Nunjucks `copySafeness`: string filters applied to a safe value return a safe value.
fn keep_safeness(input: &Value, out: Value) -> Value {
    match out {
        Value::String(s) if is_marked_safe(input) => mark_safe(s),
        other => other,
    }
}
