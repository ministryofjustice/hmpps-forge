//! Nunjucks-style default globals (`range`, `cycler`, `joiner`) and marker values for `is callable`.
//!
//! See [`nunjucks/nunjucks/src/globals.js`](https://github.com/mozilla/nunjucks/blob/master/nunjucks/src/globals.js).

use crate::errors::{Result, RunjucksError};
use serde_json::{json, Map, Value};
use std::collections::HashMap;

/// Object key for built-in global function references (Nunjucks `typeof x === 'function'` parity for `is callable`).
pub const RJ_BUILTIN: &str = "__runjucks_builtin";

/// Cycler instance handle (`__runjucks_cycler`: index into [`crate::renderer::RenderState::cyclers`]).
pub const RJ_CYCLER: &str = "__runjucks_cycler";

/// Joiner instance handle (`__runjucks_joiner`: index into [`crate::renderer::RenderState::joiners`]).
pub const RJ_JOINER: &str = "__runjucks_joiner";

/// User `add_global` values that should be treated as callable in `is callable` tests.
pub const RJ_CALLABLE: &str = "__runjucks_callable";

/// Marker object for default globals `range`, `cycler`, `joiner` (variable lookup / callable test).
pub fn builtin_marker(name: &str) -> Value {
    let mut m = Map::new();
    m.insert(RJ_BUILTIN.to_string(), Value::String(name.to_string()));
    Value::Object(m)
}

pub fn default_globals_map() -> HashMap<String, Value> {
    ["range", "cycler", "joiner"]
        .into_iter()
        .map(|n| (n.to_string(), builtin_marker(n)))
        .collect()
}

/// `true` if `v` should be considered callable (built-in function markers, user `add_global` tag).
/// Cycler/joiner **instances** are objects, not functions — Nunjucks `typeof` would be `object`.
pub fn value_is_callable(v: &Value) -> bool {
    match v {
        Value::Object(o) => o.contains_key(RJ_BUILTIN) || o.contains_key(RJ_CALLABLE),
        _ => false,
    }
}

/// `true` if `v` is the default global marker for `expected` (`range`, `cycler`, or `joiner`).
pub fn is_builtin_marker_value(v: &Value, expected: &str) -> bool {
    match v {
        Value::Object(o) => o
            .get(RJ_BUILTIN)
            .and_then(|x| x.as_str())
            .map(|s| s == expected)
            .unwrap_or(false),
        _ => false,
    }
}

fn as_f64(v: &Value) -> Result<f64> {
    match v {
        Value::Number(n) => n
            .as_f64()
            .ok_or_else(|| RunjucksError::new("invalid number in `range`")),
        _ => Err(RunjucksError::new("`range` expects numeric arguments")),
    }
}

/// Nunjucks `range(start, stop?, step?)` — see `globals.js`.
pub fn builtin_range(args: &[Value]) -> Result<Value> {
    let (start, stop, step) = match args.len() {
        0 => {
            return Err(RunjucksError::new("`range` expects at least one argument"));
        }
        1 => (0.0, as_f64(&args[0])?, 1.0),
        2 => (as_f64(&args[0])?, as_f64(&args[1])?, 1.0),
        3 => (
            as_f64(&args[0])?,
            as_f64(&args[1])?,
            if args[2].is_null() {
                1.0
            } else {
                as_f64(&args[2])?
            },
        ),
        _ => {
            return Err(RunjucksError::new(
                "`range` expects at most three arguments",
            ));
        }
    };

    if step == 0.0 {
        return Err(RunjucksError::new("`range` step cannot be zero"));
    }

    let mut out = Vec::new();
    if step > 0.0 {
        let mut i = start;
        while i < stop {
            out.push(json_num(i));
            i += step;
        }
    } else {
        let mut i = start;
        while i > stop {
            out.push(json_num(i));
            i += step;
        }
    }
    Ok(Value::Array(out))
}

fn json_num(x: f64) -> Value {
    if x.fract() == 0.0 && x >= i64::MIN as f64 && x <= i64::MAX as f64 {
        json!(x as i64)
    } else {
        json!(x)
    }
}

/// State for one `cycler(...)` instance (Nunjucks `cycler` in `globals.js`).
#[derive(Debug)]
pub struct CyclerState {
    pub items: Vec<Value>,
    /// `-1` before any `next()`; then `0..items.len()-1` wrapping.
    pos: isize,
}

impl CyclerState {
    pub fn new(items: Vec<Value>) -> Self {
        Self { items, pos: -1 }
    }

    /// Nunjucks `cycler(...).next()` — not `Iterator::next`.
    #[allow(clippy::should_implement_trait)]
    pub fn next(&mut self) -> Value {
        if self.items.is_empty() {
            return Value::Null;
        }
        self.pos += 1;
        if self.pos >= self.items.len() as isize {
            self.pos = 0;
        }
        self.items[self.pos as usize].clone()
    }
}

/// State for one `joiner(sep?)` instance.
#[derive(Debug)]
pub struct JoinerState {
    pub sep: String,
    first: bool,
}

impl JoinerState {
    pub fn new(sep: String) -> Self {
        Self { sep, first: true }
    }

    pub fn invoke(&mut self) -> String {
        if self.first {
            self.first = false;
            String::new()
        } else {
            self.sep.clone()
        }
    }
}

pub fn cycler_handle_value(id: usize) -> Value {
    json!({ RJ_CYCLER: id })
}

pub fn joiner_handle_value(id: usize) -> Value {
    json!({ RJ_JOINER: id })
}

pub fn parse_cycler_id(v: &Value) -> Option<usize> {
    match v {
        Value::Object(o) => o
            .get(RJ_CYCLER)
            .and_then(|x| x.as_u64())
            .map(|x| x as usize),
        _ => None,
    }
}

pub fn parse_joiner_id(v: &Value) -> Option<usize> {
    match v {
        Value::Object(o) => o
            .get(RJ_JOINER)
            .and_then(|x| x.as_u64())
            .map(|x| x as usize),
        _ => None,
    }
}
