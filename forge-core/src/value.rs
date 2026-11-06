//! A JavaScript-semantics value.
//!
//! Forge's TypeScript engine evaluates authored expressions as generated JavaScript, so its
//! observable behaviour depends on JS value rules: `undefined` is distinct from `null`, `===`
//! compares objects by identity, truthiness follows JS, strings measure length in UTF-16 code
//! units, and optional property access works on strings and arrays (`"abc".length`, `a[0]`).
//! `serde_json::Value` cannot express any of that, so the engine uses this type throughout and
//! converts at the JSON boundary.

use std::fmt;
use std::sync::Arc;

use indexmap::IndexMap;
use serde::de::{self, Deserialize, Deserializer, MapAccess, SeqAccess, Visitor};
use serde::ser::{Serialize, SerializeMap, SerializeSeq, Serializer};

/// Ordered string-keyed map, matching JS object key order for string keys.
pub type Map = IndexMap<Arc<str>, Value>;

#[derive(Clone, Default)]
pub enum Value {
    #[default]
    Undefined,
    Null,
    Bool(bool),
    Number(f64),
    String(Arc<str>),
    Array(Arc<Vec<Value>>),
    Object(Arc<Map>),
    /// An engine-internal object that is not plain data: a validation rule closing over its
    /// iterator scope, a block instance awaiting resolution. Behaves like a JS object (truthy,
    /// compared by identity) and serialises through its plain view.
    Opaque(Arc<dyn OpaqueValue>),
}

/// Engine-internal object carried inside a [`Value`].
pub trait OpaqueValue: std::any::Any + Send + Sync {
    /// The plain-data view used for property access and serialisation.
    fn view(&self) -> Value;
    fn as_any(&self) -> &dyn std::any::Any;
}

impl Value {
    pub fn opaque(v: impl OpaqueValue) -> Self {
        Value::Opaque(Arc::new(v))
    }

    pub fn downcast<T: 'static>(&self) -> Option<&T> {
        match self {
            Value::Opaque(o) => o.as_any().downcast_ref::<T>(),
            _ => None,
        }
    }
}

impl Value {
    pub fn string(s: impl Into<Arc<str>>) -> Self {
        Value::String(s.into())
    }

    pub fn array(items: Vec<Value>) -> Self {
        Value::Array(Arc::new(items))
    }

    pub fn object(map: Map) -> Self {
        Value::Object(Arc::new(map))
    }

    pub fn empty_object() -> Self {
        Value::Object(Arc::new(Map::new()))
    }

    pub fn from_pairs<K: Into<Arc<str>>>(pairs: impl IntoIterator<Item = (K, Value)>) -> Self {
        Value::object(pairs.into_iter().map(|(k, v)| (k.into(), v)).collect())
    }

    pub fn is_undefined(&self) -> bool {
        matches!(self, Value::Undefined)
    }

    /// JS `value == null` (loose): `null` or `undefined`.
    pub fn is_nullish(&self) -> bool {
        matches!(self, Value::Undefined | Value::Null)
    }

    pub fn as_str(&self) -> Option<&str> {
        match self {
            Value::String(s) => Some(s),
            _ => None,
        }
    }

    pub fn as_f64(&self) -> Option<f64> {
        match self {
            Value::Number(n) => Some(*n),
            _ => None,
        }
    }

    pub fn as_bool(&self) -> Option<bool> {
        match self {
            Value::Bool(b) => Some(*b),
            _ => None,
        }
    }

    pub fn as_array(&self) -> Option<&Arc<Vec<Value>>> {
        match self {
            Value::Array(a) => Some(a),
            _ => None,
        }
    }

    pub fn as_object(&self) -> Option<&Arc<Map>> {
        match self {
            Value::Object(o) => Some(o),
            _ => None,
        }
    }

    /// JS `typeof value === "object" && value !== null` (arrays included).
    pub fn is_object_like(&self) -> bool {
        matches!(self, Value::Array(_) | Value::Object(_) | Value::Opaque(_))
    }

    /// JS `typeof`.
    pub fn type_of(&self) -> &'static str {
        match self {
            Value::Undefined => "undefined",
            Value::Null | Value::Array(_) | Value::Object(_) | Value::Opaque(_) => "object",
            Value::Bool(_) => "boolean",
            Value::Number(_) => "number",
            Value::String(_) => "string",
        }
    }

    /// JS truthiness.
    pub fn truthy(&self) -> bool {
        match self {
            Value::Undefined | Value::Null => false,
            Value::Bool(b) => *b,
            Value::Number(n) => *n != 0.0 && !n.is_nan(),
            Value::String(s) => !s.is_empty(),
            Value::Array(_) | Value::Object(_) | Value::Opaque(_) => true,
        }
    }

    /// JS `===`. Objects and arrays compare by identity.
    pub fn strict_eq(&self, other: &Value) -> bool {
        match (self, other) {
            (Value::Undefined, Value::Undefined) | (Value::Null, Value::Null) => true,
            (Value::Bool(a), Value::Bool(b)) => a == b,
            (Value::Number(a), Value::Number(b)) => a == b,
            (Value::String(a), Value::String(b)) => a == b,
            (Value::Array(a), Value::Array(b)) => Arc::ptr_eq(a, b),
            (Value::Object(a), Value::Object(b)) => Arc::ptr_eq(a, b),
            (Value::Opaque(a), Value::Opaque(b)) => Arc::ptr_eq(a, b),
            _ => false,
        }
    }

    /// Structural equality (Vitest `toEqual`-style), used by tests and parity diffs.
    pub fn deep_eq(&self, other: &Value) -> bool {
        match (self, other) {
            (Value::Opaque(a), _) => a.view().deep_eq(other),
            (_, Value::Opaque(b)) => self.deep_eq(&b.view()),
            (Value::Array(a), Value::Array(b)) => {
                a.len() == b.len() && a.iter().zip(b.iter()).all(|(x, y)| x.deep_eq(y))
            }
            (Value::Object(a), Value::Object(b)) => {
                let defined = |m: &Map| m.iter().filter(|(_, v)| !v.is_undefined()).count();
                defined(a) == defined(b)
                    && a.iter()
                        .filter(|(_, v)| !v.is_undefined())
                        .all(|(k, v)| b.get(k).is_some_and(|w| v.deep_eq(w)))
            }
            _ => self.strict_eq(other),
        }
    }

    /// JS optional property access `value?.[key]` for a string key.
    pub fn get(&self, key: &str) -> Value {
        match self {
            Value::Object(o) => o.get(key).cloned().unwrap_or(Value::Undefined),
            Value::Array(a) => {
                if key == "length" {
                    return Value::Number(a.len() as f64);
                }
                match array_index(key) {
                    Some(i) => a.get(i).cloned().unwrap_or(Value::Undefined),
                    None => Value::Undefined,
                }
            }
            Value::String(s) => {
                if key == "length" {
                    return Value::Number(utf16_len(s) as f64);
                }
                match array_index(key) {
                    Some(i) => s
                        .encode_utf16()
                        .nth(i)
                        .map(|unit| Value::string(String::from_utf16_lossy(&[unit])))
                        .unwrap_or(Value::Undefined),
                    None => Value::Undefined,
                }
            }
            Value::Opaque(o) => o.view().get(key),
            _ => Value::Undefined,
        }
    }

    /// Mutable access to an object's map, cloning it first if it is shared.
    pub fn as_object_mut(&mut self) -> Option<&mut Map> {
        match self {
            Value::Object(o) => Some(Arc::make_mut(o)),
            _ => None,
        }
    }

    /// Sets `key` on an object value (no-op for non-objects).
    pub fn set(&mut self, key: impl Into<Arc<str>>, value: Value) {
        if let Some(map) = self.as_object_mut() {
            map.insert(key.into(), value);
        }
    }

    /// JS `String(value)`.
    pub fn to_js_string(&self) -> String {
        match self {
            Value::Undefined => "undefined".into(),
            Value::Null => "null".into(),
            Value::Bool(b) => b.to_string(),
            Value::Number(n) => number_to_js_string(*n),
            Value::String(s) => s.to_string(),
            Value::Array(items) => items
                .iter()
                .map(|v| if v.is_nullish() { String::new() } else { v.to_js_string() })
                .collect::<Vec<_>>()
                .join(","),
            Value::Object(_) | Value::Opaque(_) => "[object Object]".into(),
        }
    }

    /// JS `Number(value)`.
    pub fn to_js_number(&self) -> f64 {
        match self {
            Value::Undefined => f64::NAN,
            Value::Null => 0.0,
            Value::Bool(b) => f64::from(u8::from(*b)),
            Value::Number(n) => *n,
            Value::String(s) => {
                let t = s.trim();
                if t.is_empty() {
                    0.0
                } else if let Some(hex) = t.strip_prefix("0x").or_else(|| t.strip_prefix("0X")) {
                    i64::from_str_radix(hex, 16).map(|n| n as f64).unwrap_or(f64::NAN)
                } else if t == "Infinity" || t == "+Infinity" {
                    f64::INFINITY
                } else if t == "-Infinity" {
                    f64::NEG_INFINITY
                } else if t.chars().all(|c| c.is_ascii_digit() || matches!(c, '.' | 'e' | 'E' | '+' | '-')) {
                    t.parse::<f64>().unwrap_or(f64::NAN)
                } else {
                    f64::NAN
                }
            }
            Value::Array(a) => match a.len() {
                0 => 0.0,
                1 => a[0].to_js_number(),
                _ => f64::NAN,
            },
            Value::Object(_) | Value::Opaque(_) => f64::NAN,
        }
    }

    /// Converts from JSON. JSON has no `undefined`, so nothing maps to it.
    pub fn from_json(json: &serde_json::Value) -> Self {
        match json {
            serde_json::Value::Null => Value::Null,
            serde_json::Value::Bool(b) => Value::Bool(*b),
            serde_json::Value::Number(n) => Value::Number(n.as_f64().unwrap_or(f64::NAN)),
            serde_json::Value::String(s) => Value::string(s.as_str()),
            serde_json::Value::Array(a) => Value::array(a.iter().map(Value::from_json).collect()),
            serde_json::Value::Object(o) => {
                Value::object(o.iter().map(|(k, v)| (Arc::from(k.as_str()), Value::from_json(v))).collect())
            }
        }
    }

    /// Converts to JSON the way `JSON.stringify` would: `undefined` object entries are dropped,
    /// `undefined` array items become `null`, non-finite numbers become `null`.
    pub fn to_json(&self) -> serde_json::Value {
        match self {
            Value::Undefined | Value::Null => serde_json::Value::Null,
            Value::Bool(b) => serde_json::Value::Bool(*b),
            Value::Number(n) => number_to_json(*n),
            Value::String(s) => serde_json::Value::String(s.to_string()),
            Value::Array(a) => serde_json::Value::Array(a.iter().map(Value::to_json).collect()),
            Value::Object(o) => serde_json::Value::Object(
                o.iter()
                    .filter(|(_, v)| !v.is_undefined())
                    .map(|(k, v)| (k.to_string(), v.to_json()))
                    .collect(),
            ),
            Value::Opaque(o) => o.view().to_json(),
        }
    }
}

fn number_to_json(n: f64) -> serde_json::Value {
    if !n.is_finite() {
        return serde_json::Value::Null;
    }
    if n.fract() == 0.0 && n.abs() < 9_007_199_254_740_992.0 {
        return serde_json::Value::from(n as i64);
    }
    serde_json::Number::from_f64(n).map(serde_json::Value::Number).unwrap_or(serde_json::Value::Null)
}

/// Canonical array index per JS: a decimal string with no leading zeros.
fn array_index(key: &str) -> Option<usize> {
    if key.is_empty() || (key.len() > 1 && key.starts_with('0')) || !key.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    key.parse().ok()
}

/// JS `string.length`.
pub fn utf16_len(s: &str) -> usize {
    s.encode_utf16().count()
}

/// JS `Number.prototype.toString()`.
pub fn number_to_js_string(n: f64) -> String {
    if n.is_nan() {
        return "NaN".into();
    }
    if n == f64::INFINITY {
        return "Infinity".into();
    }
    if n == f64::NEG_INFINITY {
        return "-Infinity".into();
    }
    if n == 0.0 {
        return "0".into();
    }
    ryu_js::Buffer::new().format(n).to_string()
}

impl fmt::Debug for Value {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Value::Undefined => f.write_str("undefined"),
            _ => write!(f, "{}", self.to_json()),
        }
    }
}

impl fmt::Display for Value {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.to_js_string())
    }
}

impl PartialEq for Value {
    /// Structural equality; use [`Value::strict_eq`] for JS `===`.
    fn eq(&self, other: &Self) -> bool {
        self.deep_eq(other)
    }
}

impl From<bool> for Value {
    fn from(b: bool) -> Self {
        Value::Bool(b)
    }
}

impl From<f64> for Value {
    fn from(n: f64) -> Self {
        Value::Number(n)
    }
}

impl From<i64> for Value {
    fn from(n: i64) -> Self {
        Value::Number(n as f64)
    }
}

impl From<i32> for Value {
    fn from(n: i32) -> Self {
        Value::Number(f64::from(n))
    }
}

impl From<usize> for Value {
    fn from(n: usize) -> Self {
        Value::Number(n as f64)
    }
}

impl From<&str> for Value {
    fn from(s: &str) -> Self {
        Value::string(s)
    }
}

impl From<String> for Value {
    fn from(s: String) -> Self {
        Value::string(s)
    }
}

impl From<Arc<str>> for Value {
    fn from(s: Arc<str>) -> Self {
        Value::String(s)
    }
}

impl<T: Into<Value>> From<Vec<T>> for Value {
    fn from(items: Vec<T>) -> Self {
        Value::array(items.into_iter().map(Into::into).collect())
    }
}

impl<T: Into<Value>, const N: usize> From<[T; N]> for Value {
    fn from(items: [T; N]) -> Self {
        Value::array(items.into_iter().map(Into::into).collect())
    }
}

impl<T: Into<Value>> From<Option<T>> for Value {
    fn from(v: Option<T>) -> Self {
        v.map_or(Value::Undefined, Into::into)
    }
}

impl From<serde_json::Value> for Value {
    fn from(json: serde_json::Value) -> Self {
        Value::from_json(&json)
    }
}

impl Serialize for Value {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        match self {
            Value::Undefined | Value::Null => serializer.serialize_unit(),
            Value::Bool(b) => serializer.serialize_bool(*b),
            Value::Number(n) => number_to_json(*n).serialize(serializer),
            Value::String(s) => serializer.serialize_str(s),
            Value::Array(a) => {
                let mut seq = serializer.serialize_seq(Some(a.len()))?;
                for item in a.iter() {
                    seq.serialize_element(item)?;
                }
                seq.end()
            }
            Value::Object(o) => {
                let defined: Vec<_> = o.iter().filter(|(_, v)| !v.is_undefined()).collect();
                let mut map = serializer.serialize_map(Some(defined.len()))?;
                for (k, v) in defined {
                    map.serialize_entry(k.as_ref(), v)?;
                }
                map.end()
            }
            Value::Opaque(o) => o.view().serialize(serializer),
        }
    }
}

impl<'de> Deserialize<'de> for Value {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        struct ValueVisitor;

        impl<'de> Visitor<'de> for ValueVisitor {
            type Value = Value;

            fn expecting(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                f.write_str("a JSON value")
            }

            fn visit_unit<E: de::Error>(self) -> Result<Value, E> {
                Ok(Value::Null)
            }

            fn visit_none<E: de::Error>(self) -> Result<Value, E> {
                Ok(Value::Null)
            }

            fn visit_some<D: Deserializer<'de>>(self, d: D) -> Result<Value, D::Error> {
                Value::deserialize(d)
            }

            fn visit_bool<E: de::Error>(self, b: bool) -> Result<Value, E> {
                Ok(Value::Bool(b))
            }

            fn visit_i64<E: de::Error>(self, n: i64) -> Result<Value, E> {
                Ok(Value::Number(n as f64))
            }

            fn visit_u64<E: de::Error>(self, n: u64) -> Result<Value, E> {
                Ok(Value::Number(n as f64))
            }

            fn visit_f64<E: de::Error>(self, n: f64) -> Result<Value, E> {
                Ok(Value::Number(n))
            }

            fn visit_str<E: de::Error>(self, s: &str) -> Result<Value, E> {
                Ok(Value::string(s))
            }

            fn visit_seq<A: SeqAccess<'de>>(self, mut seq: A) -> Result<Value, A::Error> {
                let mut items = Vec::new();
                while let Some(item) = seq.next_element()? {
                    items.push(item);
                }
                Ok(Value::array(items))
            }

            fn visit_map<A: MapAccess<'de>>(self, mut access: A) -> Result<Value, A::Error> {
                let mut map = Map::new();
                while let Some((k, v)) = access.next_entry::<String, Value>()? {
                    map.insert(Arc::from(k), v);
                }
                Ok(Value::object(map))
            }
        }

        deserializer.deserialize_any(ValueVisitor)
    }
}

/// Builds a [`Value`] from JSON-like syntax: `val!({ "a": 1, "b": [true, null] })`.
#[macro_export]
macro_rules! val {
    ($($json:tt)+) => {
        $crate::value::Value::from_json(&::serde_json::json!($($json)+))
    };
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn js_semantics() {
        assert!(!Value::Undefined.strict_eq(&Value::Null));
        assert!(Value::Undefined.is_nullish() && Value::Null.is_nullish());
        let a = val!({"x": 1});
        assert!(a.strict_eq(&a.clone()), "clones share identity");
        assert!(!a.strict_eq(&val!({"x": 1})), "distinct objects are not ===");
        assert!(a.deep_eq(&val!({"x": 1})));
        assert_eq!(Value::from("héllo😀").get("length").as_f64(), Some(7.0));
        assert_eq!(val!([1, 2]).get("1").as_f64(), Some(2.0));
        assert!(val!([1]).get("01").is_undefined());
        assert_eq!(number_to_js_string(1.0), "1");
        assert_eq!(number_to_js_string(0.1 + 0.2), "0.30000000000000004");
        assert_eq!(number_to_js_string(1e21), "1e+21");
        assert_eq!(val!([1, null, "a"]).to_js_string(), "1,,a");
        assert!(!Value::from("").truthy() && Value::from("0").truthy() && !Value::Number(f64::NAN).truthy());
        assert_eq!(Value::from(" 12 ").to_js_number(), 12.0);
        assert!(Value::from("12px").to_js_number().is_nan());
    }

    #[test]
    fn json_round_trip_drops_undefined() {
        let mut v = val!({"a": 1});
        v.set("b", Value::Undefined);
        assert_eq!(serde_json::to_string(&v).unwrap(), r#"{"a":1}"#);
        assert_eq!(serde_json::to_string(&Value::array(vec![Value::Undefined])).unwrap(), "[null]");
        let parsed: Value = serde_json::from_str(r#"{"z":1,"a":[1.5,2]}"#).unwrap();
        assert_eq!(serde_json::to_string(&parsed).unwrap(), r#"{"z":1,"a":[1.5,2]}"#);
    }
}
