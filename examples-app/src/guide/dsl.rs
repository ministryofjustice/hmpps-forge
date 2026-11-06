//! The definition-time vocabulary the guide's journey modules are written in.
//!
//! The TS guide builds its journeys with chainable builders (`Data('x').match(...)`,
//! `match(v).branch(...)`, `Item().path('a')`) and plain JS values (object literals, arrays,
//! strings). [`D`] holds either, keeping the builder's kind, so `.path()` extends a reference
//! but wraps any other expression, exactly as the TS builders do. The prelude functions take and
//! return `D`, which lets the journey modules read like their TS originals.

#![allow(dead_code)]

use std::sync::Arc;

use forge_core::Value;
use forge_core::authoring::{self as a, Ex, ItemRef, LoopRef, Match, When};
pub use forge_core::authoring::IntoValue;
use forge_core::value::Map;

/// A definition-time value: a builder or a plain JS value.
#[derive(Clone)]
pub enum D {
    V(Value),
    Ex(Ex),
    When(When),
    Match(Match),
    Item(ItemRef),
    Loop(LoopRef),
    /// A function passed as a value (`withGroups(..., v => ...)`).
    Fn(Arc<dyn Fn(Vec<D>) -> D + Send + Sync>),
}

impl IntoValue for D {
    fn into_value(self) -> Value {
        match self {
            D::V(v) => v,
            D::Ex(e) => e.into(),
            D::When(w) => w.into_value(),
            D::Match(m) => m.into_value(),
            D::Item(i) => i.value().into(),
            D::Loop(_) => Value::Undefined,
            D::Fn(_) => Value::Undefined,
        }
    }
}

impl IntoValue for &D {
    fn into_value(self) -> Value {
        self.clone().into_value()
    }
}

impl From<Value> for D {
    fn from(v: Value) -> Self {
        D::V(v)
    }
}
impl From<Ex> for D {
    fn from(v: Ex) -> Self {
        D::Ex(v)
    }
}
impl From<When> for D {
    fn from(v: When) -> Self {
        D::When(v)
    }
}
impl From<Match> for D {
    fn from(v: Match) -> Self {
        D::Match(v)
    }
}
impl From<&str> for D {
    fn from(v: &str) -> Self {
        D::V(Value::from(v))
    }
}
impl From<String> for D {
    fn from(v: String) -> Self {
        D::V(Value::from(v))
    }
}
impl From<bool> for D {
    fn from(v: bool) -> Self {
        D::V(Value::Bool(v))
    }
}
impl From<f64> for D {
    fn from(v: f64) -> Self {
        D::V(Value::Number(v))
    }
}
impl From<i32> for D {
    fn from(v: i32) -> Self {
        D::V(Value::Number(v as f64))
    }
}
impl From<Vec<D>> for D {
    fn from(v: Vec<D>) -> Self {
        D::V(Value::array(v.into_iter().map(IntoValue::into_value).collect()))
    }
}

/// Plain values for a built-in's rest parameter.
pub fn vals(items: Vec<D>) -> Vec<Value> {
    items.into_iter().map(IntoValue::into_value).collect()
}

/// `undefined`.
pub const UNDEFINED: D = D::V(Value::Undefined);

/// An array literal of definition-time values: `arr!["a", obj! { .. }, step(..)]`.
#[macro_export]
macro_rules! arr {
    ($($item:expr),* $(,)?) => {
        $crate::guide::dsl::D::V(forge_core::Value::array(vec![$(forge_core::authoring::IntoValue::into_value($item)),*]))
    };
}
pub use crate::arr;

/// An array literal.
pub fn array(items: Vec<D>) -> D {
    D::from(items)
}

/// A function value.
pub fn func(f: impl Fn(Vec<D>) -> D + Send + Sync + 'static) -> D {
    D::Fn(Arc::new(f))
}

/// `{ ...a, ...b, key: v }`: object spread in order.
pub fn spread(parts: Vec<D>) -> D {
    let mut map = Map::new();
    for p in parts {
        if let Value::Object(o) = p.into_value() {
            for (k, v) in o.iter() {
                map.insert(k.clone(), v.clone());
            }
        }
    }
    D::V(Value::object(map))
}

/// `[...a, b]`: array spread; `items` are `(is_spread, value)`.
pub fn spread_array(items: Vec<(bool, D)>) -> D {
    let mut out = Vec::new();
    for (is_spread, d) in items {
        let v = d.into_value();
        match (is_spread, v) {
            (true, Value::Array(a)) => out.extend(a.iter().cloned()),
            (_, v) => out.push(v),
        }
    }
    D::V(Value::array(out))
}

/// A template literal: the parts stringified and joined.
pub fn template(parts: Vec<D>) -> D {
    D::from(parts.into_iter().map(|p| p.into_value().to_js_string()).collect::<String>())
}

/// JS `a + b` on definition-time values.
pub fn add(a: D, b: D) -> D {
    match (a.into_value(), b.into_value()) {
        (Value::Number(x), Value::Number(y)) => D::from(x + y),
        (x, y) => D::from(format!("{}{}", x.to_js_string(), y.to_js_string())),
    }
}

/// JS truthiness.
pub fn truthy(d: &D) -> bool {
    match d {
        D::V(v) => v.truthy(),
        _ => true,
    }
}

/// JS `a ?? b`.
pub fn coalesce(a: D, b: impl FnOnce() -> D) -> D {
    match &a {
        D::V(Value::Undefined | Value::Null) => b(),
        _ => a,
    }
}

/// JS `a === b` on plain values.
pub fn strict_eq(a: &D, b: &D) -> bool {
    a.clone().into_value().strict_eq(&b.clone().into_value())
}

impl D {
    pub fn value(&self) -> Value {
        self.clone().into_value()
    }

    fn ex(&self) -> Ex {
        match self {
            D::Ex(e) => e.clone(),
            D::Item(i) => i.value(),
            other => Ex::from_value(other.value()),
        }
    }

    /// A JS property read on a plain value (`obj.key`, `arr[0]`).
    pub fn get(&self, key: &str) -> D {
        D::V(self.value().get(key))
    }

    // Builder chains --------------------------------------------------------------------------

    /// `.path(key)`.
    pub fn path(&self, key: impl IntoValue) -> D {
        let key = key.into_value().to_js_string();
        match self {
            D::Item(i) => D::Ex(i.path(&key)),
            _ => D::Ex(self.ex().path(&key)),
        }
    }

    /// `.match(condition)`.
    pub fn matches(&self, condition: impl IntoValue) -> D {
        D::V(self.ex().matches(condition.into_value()))
    }

    /// `.not`.
    pub fn not(&self) -> D {
        D::Ex(self.ex().not())
    }

    /// `.pipe(...steps)`.
    pub fn pipe(&self, steps: Vec<D>) -> D {
        let steps: Vec<Value> = steps.into_iter().map(IntoValue::into_value).collect();
        match self {
            D::When(w) => D::Ex(w.pipe(steps)),
            D::Match(m) => D::Ex(m.pipe(steps)),
            _ => D::Ex(self.ex().pipe(steps)),
        }
    }

    /// `.each(iterator)`.
    pub fn each(&self, iterator: impl IntoValue) -> D {
        D::Ex(self.ex().each(iterator.into_value()))
    }

    /// `.nullish(fallback)` (Forge's expression, not JS `??`).
    pub fn nullish(&self, fallback: impl IntoValue) -> D {
        match self {
            D::Item(i) => D::Ex(i.nullish(fallback)),
            D::When(w) => D::Ex(w.nullish(fallback)),
            D::Match(m) => D::Ex(m.nullish(fallback)),
            _ => D::Ex(self.ex().nullish(fallback)),
        }
    }

    pub fn branch(&self, condition: impl IntoValue, value: impl IntoValue) -> D {
        match self {
            D::Match(m) => D::Match(m.clone().branch(condition.into_value(), value)),
            _ => panic!(".branch() on a non-match builder"),
        }
    }

    pub fn case(&self, expected: impl IntoValue, value: impl IntoValue) -> D {
        match self {
            D::Match(m) => D::Match(m.clone().case(expected, value)),
            _ => panic!(".case() on a non-match builder"),
        }
    }

    pub fn then(&self, value: impl IntoValue) -> D {
        match self {
            D::When(w) => D::When(w.clone().then(value)),
            _ => panic!(".then() on a non-conditional builder"),
        }
    }

    /// `.else(value)`.
    pub fn else_(&self, value: impl IntoValue) -> D {
        match self {
            D::When(w) => D::When(w.clone().otherwise(value)),
            _ => panic!(".else() on a non-conditional builder"),
        }
    }

    pub fn otherwise(&self, value: impl IntoValue) -> D {
        match self {
            D::Match(m) => D::Match(m.clone().otherwise(value)),
            D::When(w) => D::When(w.clone().otherwise(value)),
            _ => panic!(".otherwise() on a non-match builder"),
        }
    }

    /// `Item().parent` / `Loop.Parent`.
    pub fn parent(&self) -> D {
        match self {
            D::Item(i) => D::Item(i.parent()),
            D::Loop(l) => D::Loop(l.parent()),
            _ => self.get("parent"),
        }
    }

    pub fn key(&self) -> D {
        match self {
            D::Item(i) => D::Ex(i.key()),
            _ => self.get("key"),
        }
    }

    fn loop_ref(&self) -> LoopRef {
        match self {
            D::Loop(l) => *l,
            _ => panic!("not a Loop reference"),
        }
    }

    pub fn index(&self) -> D {
        D::Ex(self.loop_ref().index())
    }
    pub fn index0(&self) -> D {
        D::Ex(self.loop_ref().index0())
    }
    pub fn revindex(&self) -> D {
        D::Ex(self.loop_ref().revindex())
    }
    pub fn revindex0(&self) -> D {
        D::Ex(self.loop_ref().revindex0())
    }
    pub fn first(&self) -> D {
        D::Ex(self.loop_ref().first())
    }
    pub fn last(&self) -> D {
        D::Ex(self.loop_ref().last())
    }
    pub fn length(&self) -> D {
        match self {
            D::Loop(l) => D::Ex(l.length()),
            other => D::from(other.value().as_array().map_or(0.0, |a| a.len() as f64)),
        }
    }

    // JS values at definition time ------------------------------------------------------------

    /// `array.map(fn)`.
    pub fn map(&self, f: impl Fn(D) -> D) -> D {
        let items = self.value().as_array().map(|a| a.to_vec()).unwrap_or_default();
        array(items.into_iter().map(|v| f(D::V(v))).collect())
    }

    /// `array.join(sep)`.
    pub fn join(&self, sep: impl IntoValue) -> D {
        let sep = sep.into_value();
        let sep = if sep.is_undefined() { ",".to_string() } else { sep.to_js_string() };
        let items = self.value().as_array().map(|a| a.to_vec()).unwrap_or_default();
        D::from(items.iter().map(|v| match v {
            Value::Undefined | Value::Null => String::new(),
            v => v.to_js_string(),
        }).collect::<Vec<_>>().join(&sep))
    }

    /// Calls a function value.
    pub fn call(&self, args: Vec<D>) -> D {
        match self {
            D::Fn(f) => f(args),
            _ => panic!("calling a non-function value"),
        }
    }
}

// Prelude: the TS authoring API -------------------------------------------------------------

fn v(d: impl IntoValue) -> Value {
    d.into_value()
}

fn key(d: impl IntoValue) -> String {
    d.into_value().to_js_string()
}

pub fn step(def: impl IntoValue) -> D {
    D::V(a::step(v(def)))
}
pub fn journey(def: impl IntoValue) -> D {
    D::V(a::journey(v(def)))
}
pub fn block(def: impl IntoValue) -> D {
    D::V(a::block(v(def)))
}
pub fn field(def: impl IntoValue) -> D {
    D::V(a::field(v(def)))
}
pub fn access(def: impl IntoValue) -> D {
    D::V(a::access(v(def)))
}
pub fn submit(def: impl IntoValue) -> D {
    D::V(a::submit(v(def)))
}
pub fn redirect(def: impl IntoValue) -> D {
    D::V(a::redirect(v(def)))
}
pub fn validation(def: impl IntoValue) -> D {
    D::V(a::validation(v(def)))
}
pub fn tie_breaker(def: impl IntoValue) -> D {
    D::V(a::tie_breaker(v(def)))
}
pub fn throw_error(def: impl IntoValue) -> D {
    D::V(a::throw_error(v(def)))
}

pub fn and(operands: Vec<D>) -> D {
    D::V(a::and(operands.into_iter().map(v).collect()))
}
pub fn or(operands: Vec<D>) -> D {
    D::V(a::or(operands.into_iter().map(v).collect()))
}
pub fn xor(operands: Vec<D>) -> D {
    D::V(a::xor(operands.into_iter().map(v).collect()))
}
pub fn not(operand: impl IntoValue) -> D {
    D::V(a::not(v(operand)))
}
pub fn when(predicate: impl IntoValue) -> D {
    D::When(a::when(v(predicate)))
}
pub fn match_(subject: impl IntoValue) -> D {
    D::Match(a::match_(subject))
}

pub fn data(k: impl IntoValue) -> D {
    D::Ex(a::data(&key(k)))
}
pub fn answer(target: impl IntoValue) -> D {
    D::Ex(a::answer(target))
}
pub fn post(k: impl IntoValue) -> D {
    D::Ex(a::post(&key(k)))
}
pub fn query(k: impl IntoValue) -> D {
    D::Ex(a::query(&key(k)))
}
pub fn params(k: impl IntoValue) -> D {
    D::Ex(a::params(&key(k)))
}
pub fn session(k: impl IntoValue) -> D {
    D::Ex(a::session(&key(k)))
}
pub fn self_() -> D {
    D::Ex(a::self_())
}
pub fn item() -> D {
    D::Item(a::item())
}
#[allow(non_upper_case_globals)]
pub const Loop: D = D::Loop(a::Loop);
pub fn literal(value: impl IntoValue) -> D {
    D::Ex(a::literal(value))
}
pub fn format(template: impl IntoValue, args: Vec<D>) -> D {
    D::Ex(a::format(template, args.into_iter().map(v)))
}

pub mod request {
    use super::*;

    pub fn url() -> D {
        D::Ex(a::request::url())
    }
    pub fn path() -> D {
        D::Ex(a::request::path())
    }
    pub fn method() -> D {
        D::Ex(a::request::method())
    }
    pub fn headers(name: impl IntoValue) -> D {
        D::Ex(a::request::headers(&key(name)))
    }
    pub fn cookies(name: impl IntoValue) -> D {
        D::Ex(a::request::cookies(&key(name)))
    }
    pub fn state(k: impl IntoValue) -> D {
        D::Ex(a::request::state(&key(k)))
    }
}

pub mod iterator {
    use super::*;

    pub fn map(yield_value: impl IntoValue) -> D {
        D::V(a::iterator::map(yield_value))
    }
    pub fn filter(predicate: impl IntoValue) -> D {
        D::V(a::iterator::filter(v(predicate)))
    }
    pub fn find(predicate: impl IntoValue) -> D {
        D::V(a::iterator::find(v(predicate)))
    }
    pub fn some(predicate: impl IntoValue) -> D {
        D::V(a::iterator::some(v(predicate)))
    }
    pub fn every(predicate: impl IntoValue) -> D {
        D::V(a::iterator::every(v(predicate)))
    }
    pub fn count(predicate: impl IntoValue) -> D {
        D::V(a::iterator::count(v(predicate)))
    }
}

/// A registered function call: `{ type, name, arguments }` (effects, transformers, generators
/// registered by the guide).
pub fn function(function_type: &str, name: &str, args: Vec<D>) -> D {
    D::V(a::function_call(function_type, name, args.into_iter().map(v).collect()))
}

/// Builds a component block.
pub fn component(c: &a::Component, props: impl IntoValue) -> D {
    D::V(c.build(v(props)))
}
