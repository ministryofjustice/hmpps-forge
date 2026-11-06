//! A small runtime schema language, standing in for the Zod schemas the TS engine attaches to
//! functions (`inputSchema`, `argumentsSchema`, `outputSchema`) and field components.
//!
//! `parse` mirrors `safeParse`: it returns the parsed data on success. As in Zod, a non-strict
//! object schema strips unknown keys from its output; a strict one rejects them.

use std::sync::Arc;

use crate::value::{Map, Value};

#[derive(Clone)]
pub enum Schema {
    Any,
    String,
    Number { nonnegative: bool, integer: bool },
    Boolean,
    Null,
    Literal(Value),
    Array(Box<Schema>),
    Tuple(Vec<Schema>),
    /// A tuple whose items after the fixed ones all match the rest schema (`z.tuple([...], rest)`).
    TupleRest(Vec<Schema>, Box<Schema>),
    Object { fields: Vec<(Arc<str>, Schema)>, strict: bool },
    /// Any object; keys checked against one value schema (`z.record`).
    Record(Box<Schema>),
    Optional(Box<Schema>),
    Nullable(Box<Schema>),
    Union(Vec<Schema>),
    Custom { description: Arc<str>, check: Arc<dyn Fn(&Value) -> bool + Send + Sync> },
}

impl std::fmt::Debug for Schema {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.describe())
    }
}

impl Schema {
    pub fn number() -> Self {
        Schema::Number { nonnegative: false, integer: false }
    }

    pub fn nonnegative_number() -> Self {
        Schema::Number { nonnegative: true, integer: false }
    }

    pub fn array(of: Schema) -> Self {
        Schema::Array(Box::new(of))
    }

    pub fn optional(of: Schema) -> Self {
        Schema::Optional(Box::new(of))
    }

    pub fn object<K: Into<Arc<str>>>(fields: impl IntoIterator<Item = (K, Schema)>) -> Self {
        Schema::Object { fields: fields.into_iter().map(|(k, s)| (k.into(), s)).collect(), strict: false }
    }

    pub fn strict_object<K: Into<Arc<str>>>(fields: impl IntoIterator<Item = (K, Schema)>) -> Self {
        Schema::Object { fields: fields.into_iter().map(|(k, s)| (k.into(), s)).collect(), strict: true }
    }

    pub fn custom(description: &str, check: impl Fn(&Value) -> bool + Send + Sync + 'static) -> Self {
        Schema::Custom { description: description.into(), check: Arc::new(check) }
    }

    /// `safeParse`: the parsed value, or zod's `error.message` (the issues as indented JSON).
    pub fn parse(&self, value: &Value) -> Result<Value, String> {
        self.parse_issues(value).map_err(|issues| format_issues(&issues))
    }

    pub fn is_valid(&self, value: &Value) -> bool {
        self.parse_issues(value).is_ok()
    }

    /// `safeParse` with zod v4's issue list (every issue, not just the first).
    pub fn parse_issues(&self, value: &Value) -> Result<Value, Vec<Issue>> {
        let mut issues = Vec::new();
        let parsed = self.parse_at(value, &[], &mut issues);
        if issues.is_empty() { Ok(parsed) } else { Err(issues) }
    }

    fn invalid_type(&self, value: &Value, path: &[Value], issues: &mut Vec<Issue>) -> Value {
        issues.push(Issue::invalid_type(&self.describe(), value, path));
        Value::Undefined
    }

    fn parse_at(&self, value: &Value, path: &[Value], issues: &mut Vec<Issue>) -> Value {
        let at = |seg: Value| [path, &[seg]].concat();
        match self {
            Schema::Any => value.clone(),
            Schema::String => match value {
                Value::String(_) => value.clone(),
                _ => self.invalid_type(value, path, issues),
            },
            Schema::Number { nonnegative, integer } => match value {
                // Zod 4 numbers are finite: NaN and ±Infinity are rejected.
                Value::Number(n) if n.is_finite() => {
                    if *integer && n.fract() != 0.0 {
                        issues.push(Issue::new(
                            [("expected", Value::from("int")), ("format", Value::from("safeint")), ("code", Value::from("invalid_type"))],
                            path,
                            "Invalid input: expected int, received number".into(),
                        ));
                    } else if *nonnegative && *n < 0.0 {
                        issues.push(Issue::new(
                            [
                                ("origin", Value::from("number")),
                                ("code", Value::from("too_small")),
                                ("minimum", Value::Number(0.0)),
                                ("inclusive", Value::Bool(true)),
                            ],
                            path,
                            "Too small: expected number to be >=0".into(),
                        ));
                    }
                    value.clone()
                }
                _ => self.invalid_type(value, path, issues),
            },
            Schema::Boolean => match value {
                Value::Bool(_) => value.clone(),
                _ => self.invalid_type(value, path, issues),
            },
            Schema::Null => match value {
                Value::Null => Value::Null,
                _ => self.invalid_type(value, path, issues),
            },
            Schema::Literal(expected) => {
                if !expected.strict_eq(value) {
                    issues.push(Issue::new(
                        [("code", Value::from("invalid_value")), ("values", Value::array(vec![expected.clone()]))],
                        path,
                        format!("Invalid input: expected {}", expected.to_json()),
                    ));
                }
                value.clone()
            }
            Schema::Array(of) => match value {
                Value::Array(items) => {
                    Value::array(items.iter().enumerate().map(|(i, item)| of.parse_at(item, &at(Value::Number(i as f64)), issues)).collect())
                }
                _ => self.invalid_type(value, path, issues),
            },
            Schema::Tuple(schemas) => match value {
                Value::Array(items) => {
                    if items.len() > schemas.len() {
                        issues.push(Issue::new(
                            [
                                ("origin", Value::from("array")),
                                ("code", Value::from("too_big")),
                                ("maximum", Value::Number(schemas.len() as f64)),
                                ("inclusive", Value::Bool(true)),
                            ],
                            path,
                            format!("Too big: expected array to have <={} items", schemas.len()),
                        ));
                        return value.clone();
                    }
                    let mut out = Vec::with_capacity(schemas.len());
                    for (i, schema) in schemas.iter().enumerate() {
                        let item = items.get(i).cloned().unwrap_or(Value::Undefined);
                        if item.is_undefined() && matches!(schema, Schema::Optional(_)) && i >= items.len() {
                            continue;
                        }
                        out.push(schema.parse_at(&item, &at(Value::Number(i as f64)), issues));
                    }
                    Value::array(out)
                }
                _ => self.invalid_type(value, path, issues),
            },
            Schema::TupleRest(schemas, rest) => match value {
                Value::Array(items) => {
                    let mut out = Vec::with_capacity(items.len());
                    for (i, item) in items.iter().enumerate() {
                        let schema = schemas.get(i).unwrap_or(rest);
                        out.push(schema.parse_at(item, &at(Value::Number(i as f64)), issues));
                    }
                    for (i, schema) in schemas.iter().enumerate().skip(items.len()) {
                        out.push(schema.parse_at(&Value::Undefined, &at(Value::Number(i as f64)), issues));
                    }
                    Value::array(out)
                }
                _ => self.invalid_type(value, path, issues),
            },
            Schema::Object { fields, strict } => match value {
                Value::Object(o) => {
                    let mut out = Map::new();
                    for (name, schema) in fields {
                        let field = o.get(name).cloned().unwrap_or(Value::Undefined);
                        let parsed = schema.parse_at(&field, &at(Value::from(&**name)), issues);
                        if !(parsed.is_undefined() && !o.contains_key(name)) {
                            out.insert(name.clone(), parsed);
                        }
                    }
                    if *strict {
                        let extra: Vec<Value> =
                            o.keys().filter(|k| !fields.iter().any(|(f, _)| f == *k)).map(|k| Value::from(&**k)).collect();
                        if !extra.is_empty() {
                            let names = extra.iter().map(|k| k.to_json().to_string()).collect::<Vec<_>>().join(", ");
                            let message =
                                if extra.len() == 1 { format!("Unrecognized key: {names}") } else { format!("Unrecognized keys: {names}") };
                            issues.push(Issue::new([("code", Value::from("unrecognized_keys")), ("keys", Value::array(extra))], path, message));
                        }
                    }
                    Value::object(out)
                }
                _ => self.invalid_type(value, path, issues),
            },
            Schema::Record(of) => match value {
                Value::Object(o) => {
                    let mut out = Map::new();
                    for (k, v) in o.iter() {
                        out.insert(k.clone(), of.parse_at(v, &at(Value::from(&**k)), issues));
                    }
                    Value::object(out)
                }
                _ => self.invalid_type(value, path, issues),
            },
            Schema::Optional(of) => {
                if value.is_undefined() {
                    Value::Undefined
                } else {
                    of.parse_at(value, path, issues)
                }
            }
            Schema::Nullable(of) => {
                if matches!(value, Value::Null) {
                    Value::Null
                } else {
                    of.parse_at(value, path, issues)
                }
            }
            Schema::Union(options) => {
                let mut errors = Vec::new();
                for option in options {
                    match option.parse_issues(value) {
                        Ok(v) => return v,
                        Err(e) => errors.push(Value::array(e.into_iter().map(|i| i.to_value()).collect())),
                    }
                }
                issues.push(Issue::new([("code", Value::from("invalid_union")), ("errors", Value::array(errors))], path, "Invalid input".into()));
                Value::Undefined
            }
            Schema::Custom { check, .. } => {
                if !check(value) {
                    issues.push(Issue::new([("code", Value::from("custom"))], path, "Invalid input".into()));
                }
                value.clone()
            }
        }
    }

    pub fn describe(&self) -> String {
        match self {
            Schema::Any => "any".into(),
            Schema::String => "string".into(),
            Schema::Number { .. } => "number".into(),
            Schema::Boolean => "boolean".into(),
            Schema::Null => "null".into(),
            Schema::Literal(v) => format!("{v:?}"),
            Schema::Array(_) => "array".into(),
            Schema::Tuple(_) | Schema::TupleRest(..) => "tuple".into(),
            Schema::Object { .. } | Schema::Record(_) => "object".into(),
            Schema::Optional(of) => of.describe(),
            Schema::Nullable(of) => format!("{} | null", of.describe()),
            Schema::Union(options) => options.iter().map(Schema::describe).collect::<Vec<_>>().join(" | "),
            Schema::Custom { description, .. } => description.to_string(),
        }
    }
}

/// A zod v4 issue: its code-specific fields (in zod's key order), `path` and `message`.
#[derive(Clone, Debug, PartialEq)]
pub struct Issue {
    pub fields: Vec<(&'static str, Value)>,
    pub path: Vec<Value>,
    pub message: String,
}

impl Issue {
    fn new<const N: usize>(fields: [(&'static str, Value); N], path: &[Value], message: String) -> Self {
        Self { fields: fields.to_vec(), path: path.to_vec(), message }
    }

    fn invalid_type(expected: &str, value: &Value, path: &[Value]) -> Self {
        Self::new(
            [("expected", Value::from(expected)), ("code", Value::from("invalid_type"))],
            path,
            format!("Invalid input: expected {expected}, received {}", received(value)),
        )
    }

    pub fn code(&self) -> &str {
        self.fields.iter().find(|(k, _)| *k == "code").and_then(|(_, v)| v.as_str()).unwrap_or_default()
    }

    /// The issue as zod serialises it.
    pub fn to_value(&self) -> Value {
        let mut m = Map::new();
        for (k, v) in &self.fields {
            m.insert((*k).into(), v.clone());
        }
        m.insert("path".into(), Value::array(self.path.clone()));
        m.insert("message".into(), Value::from(self.message.as_str()));
        Value::object(m)
    }
}

/// zod v4's `ZodError.message`: `JSON.stringify(issues, null, 2)`.
pub fn format_issues(issues: &[Issue]) -> String {
    let json = Value::array(issues.iter().map(Issue::to_value).collect()).to_json();
    serde_json::to_string_pretty(&json).unwrap_or_default()
}

fn received(value: &Value) -> &'static str {
    match value {
        Value::Undefined => "undefined",
        Value::Null => "null",
        Value::Bool(_) => "boolean",
        Value::Number(n) if n.is_nan() => "NaN",
        Value::Number(_) => "number",
        Value::String(_) => "string",
        Value::Array(_) => "array",
        Value::Object(_) | Value::Opaque(_) => "object",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::val;

    #[test]
    fn object_schemas_strip_or_reject_unknown_keys() {
        let loose = Schema::object([("a", Schema::String)]);
        assert_eq!(loose.parse(&val!({"a": "x", "b": 1})).unwrap(), val!({"a": "x"}));
        let strict = Schema::strict_object([("a", Schema::String)]);
        assert!(strict.parse(&val!({"a": "x", "b": 1})).is_err());
        assert!(Schema::array(Schema::String).parse(&val!(["a", 1])).is_err());
        assert!(Schema::nonnegative_number().parse(&val!(-1)).is_err());
    }
}
