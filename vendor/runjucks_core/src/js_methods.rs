//! JavaScript methods Nunjucks templates call on values (`list.concat(x)`, `[a, b].includes(v)`).
//!
//! Nunjucks evaluates templates as JavaScript, so any `Array.prototype` / `String.prototype`
//! method is callable. This covers the non-mutating ones real-world macro libraries use
//! (govuk-frontend, MOJ frontend). Mutating methods such as `push` are intentionally absent:
//! values here are immutable JSON, so they cannot update the binding they were called on.

use crate::errors::Result;
use crate::value::{is_marked_safe, value_to_string};
use serde_json::Value;

/// Returns `None` when `method` is not a supported method for `receiver`'s type.
pub fn call(receiver: &Value, method: &str, args: &[Value]) -> Option<Result<Value>> {
    match (receiver, method) {
        (Value::Array(items), "concat") => {
            let mut out = items.clone();
            for a in args {
                match a {
                    Value::Array(more) => out.extend(more.iter().cloned()),
                    other => out.push(other.clone()),
                }
            }
            Some(Ok(Value::Array(out)))
        }
        (Value::Array(items), "join") => {
            // `Array.prototype.join`: separator defaults to ","; null / undefined elements are empty.
            let sep = match args.first() {
                None | Some(Value::Null) => ",".to_string(),
                Some(s) => value_to_string(s),
            };
            let parts: Vec<String> = items
                .iter()
                .map(|v| if v.is_null() { String::new() } else { value_to_string(v) })
                .collect();
            Some(Ok(Value::String(parts.join(&sep))))
        }
        (Value::Array(items), "includes") => {
            let needle = args.first().cloned().unwrap_or(Value::Null);
            Some(Ok(Value::Bool(items.iter().any(|v| same_value_zero(v, &needle)))))
        }
        (Value::Array(items), "indexOf") => {
            let needle = args.first().cloned().unwrap_or(Value::Null);
            let i = items.iter().position(|v| same_value_zero(v, &needle));
            Some(Ok(Value::from(i.map_or(-1, |i| i as i64))))
        }
        (Value::Array(items), "slice") => {
            let (start, end) = slice_bounds(items.len(), args);
            Some(Ok(Value::Array(items[start..end].to_vec())))
        }
        (Value::String(_), _) | (Value::Object(_), _) if is_string_like(receiver) => {
            let s = value_to_string(receiver);
            match method {
                "includes" => {
                    let needle = args.first().map(value_to_string).unwrap_or_default();
                    Some(Ok(Value::Bool(s.contains(&needle))))
                }
                "startsWith" => {
                    let needle = args.first().map(value_to_string).unwrap_or_default();
                    Some(Ok(Value::Bool(s.starts_with(&needle))))
                }
                "endsWith" => {
                    let needle = args.first().map(value_to_string).unwrap_or_default();
                    Some(Ok(Value::Bool(s.ends_with(&needle))))
                }
                "slice" => {
                    let chars: Vec<char> = s.chars().collect();
                    let (start, end) = slice_bounds(chars.len(), args);
                    Some(Ok(Value::String(chars[start..end].iter().collect())))
                }
                "toUpperCase" => Some(Ok(Value::String(s.to_uppercase()))),
                "toLowerCase" => Some(Ok(Value::String(s.to_lowercase()))),
                "trim" => Some(Ok(Value::String(s.trim().to_string()))),
                _ => None,
            }
        }
        _ => None,
    }
}

fn is_string_like(v: &Value) -> bool {
    matches!(v, Value::String(_)) || is_marked_safe(v)
}

/// JS `SameValueZero` for JSON values: numbers compare numerically, everything else structurally.
fn same_value_zero(a: &Value, b: &Value) -> bool {
    match (a, b) {
        (Value::Number(x), Value::Number(y)) => x.as_f64() == y.as_f64(),
        _ => a == b,
    }
}

/// JS `slice(start, end)` bounds with negative-index support.
fn slice_bounds(len: usize, args: &[Value]) -> (usize, usize) {
    let resolve = |v: Option<&Value>, default: usize| -> usize {
        match v.and_then(Value::as_f64) {
            None => default,
            Some(n) if n < 0.0 => len.saturating_sub((-n) as usize),
            Some(n) => (n as usize).min(len),
        }
    };
    let start = resolve(args.first(), 0);
    let end = resolve(args.get(1), len);
    (start, end.max(start))
}
