//! Shared pure-computation helpers used by both the synchronous [`crate::renderer`]
//! and the asynchronous [`crate::async_renderer`] (when the `async` feature is enabled).
//!
//! These functions have no `&mut` state dependencies and can be called from any context.

use crate::ast::{CompareOp, Expr};
use crate::errors::{Result, RunjucksError};
use crate::value::is_undefined_value;
use serde_json::{json, Map, Value};
use std::borrow::Cow;
use std::cmp::Ordering;
use std::sync::Arc;

use crate::globals::{
    builtin_range, cycler_handle_value, is_builtin_marker_value, joiner_handle_value,
    CyclerState, JoinerState,
};

use ahash::AHashMap;

/// `{% extends %}` parent expression plus block name → AST bodies.
/// `(parent expression, top-level blocks, prelude)`: the prelude is every other top-level node
/// (sets, imports, loops...), which Nunjucks runs for its side effects before the parent renders.
pub type ExtendsLayout = (Expr, std::collections::HashMap<String, Vec<crate::ast::Node>>, Vec<crate::ast::Node>);

/// Nunjucks truthiness: `null`, `false`, `0`/`NaN`, and `""` are falsy.
pub fn is_truthy(v: &Value) -> bool {
    if is_undefined_value(v) {
        return false;
    }
    match v {
        Value::Null | Value::Bool(false) => false,
        Value::Bool(true) => true,
        Value::Number(n) => n.as_f64().map(|x| x != 0.0 && !x.is_nan()).unwrap_or(true),
        Value::String(s) => !s.is_empty(),
        Value::Array(_) | Value::Object(_) => true,
    }
}

/// Comparison operators.
pub fn compare_values(left: &Value, op: CompareOp, right: &Value) -> bool {
    match op {
        CompareOp::Eq | CompareOp::StrictEq => left == right,
        CompareOp::Ne | CompareOp::StrictNe => left != right,
        CompareOp::Lt => json_partial_cmp(left, right) == Some(Ordering::Less),
        CompareOp::Gt => json_partial_cmp(left, right) == Some(Ordering::Greater),
        CompareOp::Le => matches!(
            json_partial_cmp(left, right),
            Some(Ordering::Less | Ordering::Equal)
        ),
        CompareOp::Ge => matches!(
            json_partial_cmp(left, right),
            Some(Ordering::Greater | Ordering::Equal)
        ),
    }
}

/// Partial ordering for numbers and strings.
pub fn json_partial_cmp(a: &Value, b: &Value) -> Option<Ordering> {
    match (a, b) {
        (Value::Number(x), Value::Number(y)) => {
            let xf = x.as_f64()?;
            let yf = y.as_f64()?;
            xf.partial_cmp(&yf)
        }
        (Value::String(x), Value::String(y)) => Some(x.cmp(y)),
        _ => None,
    }
}

/// Numeric coercion: number, string parse, bool → 0/1.
pub fn as_number(v: &Value) -> Option<f64> {
    match v {
        Value::Number(n) => n.as_f64(),
        Value::String(s) => s.parse().ok(),
        Value::Bool(b) => Some(if *b { 1.0 } else { 0.0 }),
        _ => None,
    }
}

/// Handles `+` operator: numeric add or string concat.
pub fn add_like_js(a: &Value, b: &Value) -> Value {
    if let (Some(x), Some(y)) = (as_number(a), as_number(b)) {
        json_num(x + y)
    } else {
        Value::String(format!("{}{}", js_to_string(a), js_to_string(b)))
    }
}

/// JavaScript `String(v)` as used by `+` concatenation: unlike template output, `undefined`
/// and `null` become the literal words, arrays join with commas, objects are `[object Object]`.
fn js_to_string(v: &Value) -> String {
    use crate::value::{is_marked_safe, is_undefined_value, value_to_string};
    match v {
        _ if is_undefined_value(v) => "undefined".into(),
        _ if is_marked_safe(v) => value_to_string(v),
        Value::Null => "null".into(),
        Value::Array(items) => items
            .iter()
            .map(|i| if i.is_null() || is_undefined_value(i) { String::new() } else { js_to_string(i) })
            .collect::<Vec<_>>()
            .join(","),
        Value::Object(_) => "[object Object]".into(),
        _ => value_to_string(v),
    }
}

/// Converts float to int if no fractional part.
pub fn json_num(x: f64) -> Value {
    if x.fract() == 0.0 && x >= i64::MIN as f64 && x <= i64::MAX as f64 {
        json!(x as i64)
    } else {
        json!(x)
    }
}

/// Implements membership test: array element, string substring, object key.
pub fn eval_in(key: &Value, container: &Value) -> Result<bool> {
    match container {
        Value::Array(a) => Ok(a.iter().any(|v| v == key)),
        Value::String(s) => {
            let frag = match key {
                Value::String(k) => k.as_str(),
                _ => return Ok(false),
            };
            Ok(s.contains(frag))
        }
        Value::Object(o) => match key {
            Value::String(k) => Ok(o.contains_key(k)),
            _ => Ok(false),
        },
        _ => Err(RunjucksError::new(
            "Cannot use \"in\" operator to search in unexpected type",
        )),
    }
}

/// Right-hand side of `is`: identifier, string/null literal, or call (`equalto(3)`).
pub fn is_test_parts(e: &Expr) -> Option<(&str, &[Expr])> {
    match e {
        Expr::Variable(n) => Some((n.as_str(), &[])),
        Expr::Literal(Value::String(s)) => Some((s.as_str(), &[])),
        Expr::Literal(Value::Null) => Some(("null", &[])),
        Expr::Call {
            callee,
            args,
            kwargs,
        } => {
            if !kwargs.is_empty() {
                return None;
            }
            if let Expr::Variable(n) = callee.as_ref() {
                Some((n.as_str(), args.as_slice()))
            } else {
                None
            }
        }
        _ => None,
    }
}

/// Jinja-compat slice (`nunjucks` `sliceLookup`).
pub fn jinja_slice_array(
    obj: &[Value],
    start: Option<i64>,
    stop: Option<i64>,
    step: Option<i64>,
) -> Vec<Value> {
    let len = obj.len() as i64;
    let step = step.unwrap_or(1);
    if step == 0 {
        return vec![];
    }
    let mut start = start;
    let mut stop = stop;
    if start.is_none() {
        start = Some(if step < 0 { (len - 1).max(0) } else { 0 });
    }
    if stop.is_none() {
        stop = Some(if step < 0 { -1 } else { len });
    } else if let Some(s) = stop {
        if s < 0 {
            stop = Some(s + len);
        }
    }
    if let Some(s) = start {
        if s < 0 {
            start = Some(s + len);
        }
    }
    let start = start.unwrap_or(0);
    let stop = stop.unwrap_or(len);
    let mut results = Vec::new();
    let mut i = start;
    loop {
        if i < 0 || i > len {
            break;
        }
        if step > 0 && i >= stop {
            break;
        }
        if step < 0 && i <= stop {
            break;
        }
        if let Some(item) = obj.get(i as usize) {
            results.push(item.clone());
        }
        i += step;
    }
    results
}

/// Iteration abstraction for `for` loops.
pub enum Iterable {
    Rows(Vec<Value>),
    Pairs(Vec<(String, Value)>),
}

/// Converts a `Value` to an `Iterable`.
pub fn iterable_from_value(v: Value) -> Iterable {
    match v {
        Value::Null => Iterable::Rows(vec![]),
        Value::Array(a) => Iterable::Rows(a),
        // Insertion order, like JS `for..in` (needs serde_json `preserve_order`).
        Value::Object(o) => Iterable::Pairs(o.into_iter().collect()),
        _ => Iterable::Rows(vec![]),
    }
}

/// Checks if an iterable is empty.
pub fn iterable_empty(it: &Iterable) -> bool {
    match it {
        Iterable::Rows(a) => a.is_empty(),
        Iterable::Pairs(p) => p.is_empty(),
    }
}

/// Fills a `loop` variable object for `for` loops.
pub fn fill_loop_object(m: &mut Map<String, Value>, i: usize, len: usize) {
    m.insert("index".to_string(), Value::Number(((i + 1) as u64).into()));
    m.insert("index0".to_string(), Value::Number((i as u64).into()));
    m.insert("first".to_string(), Value::Bool(i == 0));
    m.insert("last".to_string(), Value::Bool(len > 0 && i + 1 == len));
    m.insert("length".to_string(), Value::Number((len as u64).into()));
    m.insert(
        "revindex".to_string(),
        Value::Number((len.saturating_sub(i) as u64).into()),
    );
    m.insert(
        "revindex0".to_string(),
        Value::Number((len.saturating_sub(1).saturating_sub(i) as u64).into()),
    );
}

/// Reuses the same `loop` object map in the innermost frame when possible.
pub fn inject_loop(frames: &mut Vec<AHashMap<String, Arc<Value>>>, i: usize, len: usize) {
    let inner = frames
        .last_mut()
        .expect("inject_loop requires an active frame");
    match inner.get_mut("loop") {
        Some(arc) => match Arc::make_mut(arc) {
            Value::Object(m) => fill_loop_object(m, i, len),
            _ => {
                let mut m = Map::with_capacity(7);
                fill_loop_object(&mut m, i, len);
                *arc = Arc::new(Value::Object(m));
            }
        },
        None => {
            let mut m = Map::with_capacity(7);
            fill_loop_object(&mut m, i, len);
            inner.insert("loop".to_string(), Arc::new(Value::Object(m)));
        }
    }
    // Note: caller must bump_revision() after calling this
}

/// Checks if a name can be dispatched as a builtin function.
pub fn can_dispatch_builtin_check(is_defined: bool, binding: Option<&Value>, name: &str) -> bool {
    matches!(name, "range" | "cycler" | "joiner")
        && (!is_defined
            || binding
                .map(|v| is_builtin_marker_value(v, name))
                .unwrap_or(false))
}

/// Dispatches builtin function calls (`range`, `cycler`, `joiner`).
pub fn try_dispatch_builtin(
    cyclers: &mut Vec<CyclerState>,
    joiners: &mut Vec<JoinerState>,
    is_defined: bool,
    binding: Option<&Value>,
    name: &str,
    arg_vals: &[Value],
) -> Option<Result<Value>> {
    if !can_dispatch_builtin_check(is_defined, binding, name) {
        return None;
    }
    match name {
        "range" => Some(builtin_range(arg_vals)),
        "cycler" => {
            let id = cyclers.len();
            cyclers.push(CyclerState::new(arg_vals.to_vec()));
            Some(Ok(cycler_handle_value(id)))
        }
        "joiner" => {
            let sep = match arg_vals.len() {
                0 => ",".to_string(),
                1 => {
                    let s = crate::value::value_to_string(&arg_vals[0]);
                    if s.is_empty() {
                        ",".to_string()
                    } else {
                        s
                    }
                }
                _ => return Some(Err(RunjucksError::new("`joiner` expects 0 or 1 arguments"))),
            };
            let id = joiners.len();
            joiners.push(JoinerState::new(sep));
            Some(Ok(joiner_handle_value(id)))
        }
        _ => None,
    }
}

/// If `e` is a chain of `.attr` segments on a plain variable (`foo.bar.baz`), returns the root
/// name and path segments in order.
pub fn collect_attr_chain_from_getattr<'a>(mut e: &'a Expr) -> Option<(&'a str, Vec<&'a str>)> {
    let mut attrs: Vec<&'a str> = Vec::new();
    loop {
        match e {
            Expr::GetAttr { base, attr } => {
                attrs.push(attr.as_str());
                e = base.as_ref();
            }
            Expr::Variable(name) => {
                attrs.reverse();
                return Some((name.as_str(), attrs));
            }
            _ => return None,
        }
    }
}

/// Peels a chain of built-in `upper` / `lower` / `capitalize` / `trim` / `length` filters.
/// Returns filter names in **application** order and the leaf expression.
pub fn peel_builtin_upper_lower_length_chain<'a>(
    mut e: &'a Expr,
    custom_filters: &std::collections::HashMap<String, crate::environment::CustomFilter>,
) -> Option<(Vec<&'a str>, &'a Expr)> {
    let mut names: Vec<&'a str> = Vec::new();
    loop {
        match e {
            Expr::Filter { name, input, args }
                if args.is_empty() && !custom_filters.contains_key(name) =>
            {
                let n = name.as_str();
                if !matches!(n, "upper" | "lower" | "length" | "trim" | "capitalize") {
                    return None;
                }
                names.push(n);
                e = input.as_ref();
            }
            _ => break,
        }
    }
    if names.is_empty() {
        return None;
    }
    names.reverse();
    if !builtin_filter_chain_application_order_valid(&names) {
        return None;
    }
    Some((names, e))
}

/// `length` may only appear as the final step.
pub fn builtin_filter_chain_application_order_valid(rev_names: &[&str]) -> bool {
    if rev_names.is_empty() {
        return false;
    }
    let last = rev_names.len() - 1;
    for (i, &name) in rev_names.iter().enumerate() {
        match name {
            "upper" | "lower" | "trim" | "capitalize" => {}
            "length" => {
                if i != last {
                    return false;
                }
            }
            _ => return false,
        }
    }
    true
}

/// Applies a chain of builtin filters on a Cow value.
pub fn apply_builtin_filter_chain_on_cow_value(
    mut current: Cow<'_, Value>,
    rev_names: &[&str],
) -> Result<Value> {
    for n in rev_names {
        match *n {
            "upper" => {
                let t = crate::value::value_to_string(current.as_ref()).to_uppercase();
                current = Cow::Owned(Value::String(t));
            }
            "lower" => {
                let t = crate::value::value_to_string(current.as_ref()).to_lowercase();
                current = Cow::Owned(Value::String(t));
            }
            "trim" => {
                let t = crate::filters::chain_trim_like_builtin(current.as_ref());
                current = Cow::Owned(t);
            }
            "capitalize" => {
                let t = crate::filters::chain_capitalize_like_builtin(current.as_ref());
                current = Cow::Owned(t);
            }
            "length" => {
                return Ok(match current.as_ref() {
                    Value::String(s) => json!(s.chars().count()),
                    Value::Array(a) => json!(a.len()),
                    Value::Object(o) => json!(o.len()),
                    x if is_undefined_value(x) => json!(0),
                    _ => json!(0),
                });
            }
            _ => unreachable!(),
        }
    }
    Ok(current.into_owned())
}
