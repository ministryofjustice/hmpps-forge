//! The slice of zod v4 the DSL schemas use, with zod's issue semantics: which issues abort, how
//! unions and discriminated unions report failures, how optional object keys behave, and the
//! English locale's messages (`zod/v4/locales/en`). Messages here must stay byte-identical to
//! zod's, because they surface in Forge's registration errors.

use std::sync::LazyLock;

use crate::value::Value;

#[derive(Clone, Debug, PartialEq)]
pub enum Seg {
    Key(String),
    Index(usize),
}

/// A zod issue: code, path, message, `expected` (invalid_type only), and whether it lets
/// parsing continue (checks and refinements do; type mismatches abort).
#[derive(Clone, Debug)]
pub struct Issue {
    pub code: &'static str,
    pub path: Vec<Seg>,
    pub message: String,
    pub expected: Option<String>,
    pub continues: bool,
}

impl Issue {
    fn new(code: &'static str, message: String) -> Self {
        Self { code, path: vec![], message, expected: None, continues: false }
    }

    fn invalid_type(expected: &str, input: &Value) -> Self {
        Self {
            expected: Some(expected.to_string()),
            ..Self::new("invalid_type", format!("Invalid input: expected {expected}, received {}", received(input)))
        }
    }

    fn prefixed(mut self, seg: Seg) -> Self {
        self.path.insert(0, seg);
        self
    }
}

/// zod's `parsedType` name for a value, as the locale prints it.
fn received(v: &Value) -> String {
    match v {
        Value::Undefined => "undefined".into(),
        Value::Null => "null".into(),
        Value::Bool(_) => "boolean".into(),
        Value::Number(n) if n.is_nan() => "NaN".into(),
        Value::Number(n) if !n.is_finite() => Value::Number(*n).to_js_string(),
        Value::Number(_) => "number".into(),
        Value::String(_) => "string".into(),
        Value::Array(_) => "array".into(),
        Value::Object(_) | Value::Opaque(_) => "object".into(),
    }
}

/// `util.stringifyPrimitive`.
fn stringify_primitive(v: &Value) -> String {
    match v {
        Value::String(s) => Value::from(s.as_ref()).to_json().to_string(),
        other => other.to_js_string(),
    }
}

pub type Refinement = fn(&Value) -> Option<String>;

/// A zod schema node.
pub enum Z {
    /// `z.any()` / `z.unknown()`.
    Any,
    /// `z.string()`, optionally `.trim()` and `.min(n, message?)`.
    Str { trim: bool, min: Option<(usize, Option<&'static str>)> },
    /// `z.number()`, optionally `.int()`, `.min()`, `.max()`.
    Num { int: bool, min: Option<f64>, max: Option<f64> },
    Bool,
    Null,
    Literal(Value),
    Enum(Vec<Value>),
    Array { item: Box<Z>, min: Option<usize> },
    /// `z.object` / `z.looseObject` (unknown keys are never an issue for either).
    Object(Vec<(&'static str, Z)>),
    /// `z.record(z.string(), value)`.
    Record(Box<Z>),
    Optional(Box<Z>),
    Union(Vec<Z>),
    /// `z.discriminatedUnion(key, options)`: each option with its discriminator literal.
    Disc { key: &'static str, options: Vec<(Value, Z)> },
    /// `z.lazy(() => schema)`.
    Lazy(&'static LazyLock<Z>),
    /// `z.preprocess(fn, schema)`.
    Preprocess(fn(&Value) -> Value, Box<Z>),
    /// `.superRefine(...)`: a custom issue when the refinement returns a message.
    Refine(Box<Z>, Refinement),
}

pub fn string() -> Z {
    Z::Str { trim: false, min: None }
}
pub fn trimmed_min(min: usize) -> Z {
    Z::Str { trim: true, min: Some((min, None)) }
}
pub fn number() -> Z {
    Z::Num { int: false, min: None, max: None }
}
pub fn literal(v: &str) -> Z {
    Z::Literal(Value::from(v))
}
pub fn array(item: Z) -> Z {
    Z::Array { item: Box::new(item), min: None }
}
pub fn array_min(item: Z, min: usize) -> Z {
    Z::Array { item: Box::new(item), min: Some(min) }
}
pub fn record(value: Z) -> Z {
    Z::Record(Box::new(value))
}
pub fn optional(inner: Z) -> Z {
    Z::Optional(Box::new(inner))
}
pub fn object(fields: Vec<(&'static str, Z)>) -> Z {
    Z::Object(fields)
}
pub fn lazy(schema: &'static LazyLock<Z>) -> Z {
    Z::Lazy(schema)
}

fn aborted(issues: &[Issue]) -> bool {
    issues.iter().any(|i| !i.continues)
}

/// UTF-16 length, as JS `.length`.
fn js_len(s: &str) -> usize {
    s.encode_utf16().count()
}

impl Z {
    /// zod's `optin`: whether an absent object key is allowed.
    fn optional_in(&self) -> bool {
        match self {
            Z::Any | Z::Optional(_) => true,
            Z::Union(options) => options.iter().any(Z::optional_in),
            Z::Lazy(inner) => inner.optional_in(),
            Z::Refine(inner, _) => inner.optional_in(),
            _ => false,
        }
    }

    /// The issues zod reports for `value`, in zod's order.
    pub fn issues(&self, value: &Value) -> Vec<Issue> {
        match self {
            Z::Any => vec![],
            Z::Str { trim, min } => {
                let Value::String(s) = value else { return vec![Issue::invalid_type("string", value)] };
                let s: &str = if *trim { s.trim() } else { s };
                match min {
                    Some((n, message)) if js_len(s) < *n => vec![Issue {
                        continues: true,
                        ..Issue::new(
                            "too_small",
                            message.map(str::to_string).unwrap_or_else(|| format!("Too small: expected string to have >={n} characters")),
                        )
                    }],
                    _ => vec![],
                }
            }
            Z::Num { int, min, max } => {
                let n = match value {
                    Value::Number(n) if n.is_finite() => *n,
                    _ => return vec![Issue::invalid_type("number", value)],
                };
                let mut out = Vec::new();
                if *int && n.fract() != 0.0 {
                    out.push(Issue {
                        expected: Some("int".into()),
                        continues: true,
                        ..Issue::new("invalid_type", "Invalid input: expected int, received number".into())
                    });
                }
                if let Some(m) = min
                    && n < *m
                {
                    out.push(Issue { continues: true, ..Issue::new("too_small", format!("Too small: expected number to be >={m}")) });
                }
                if let Some(m) = max
                    && n > *m
                {
                    out.push(Issue { continues: true, ..Issue::new("too_big", format!("Too big: expected number to be <={m}")) });
                }
                out
            }
            Z::Bool => match value {
                Value::Bool(_) => vec![],
                _ => vec![Issue::invalid_type("boolean", value)],
            },
            Z::Null => match value {
                Value::Null => vec![],
                _ => vec![Issue::invalid_type("null", value)],
            },
            Z::Literal(expected) => {
                if expected.strict_eq(value) {
                    vec![]
                } else {
                    vec![Issue::new("invalid_value", format!("Invalid input: expected {}", stringify_primitive(expected)))]
                }
            }
            Z::Enum(values) => {
                if values.iter().any(|v| v.strict_eq(value)) {
                    vec![]
                } else if values.len() == 1 {
                    vec![Issue::new("invalid_value", format!("Invalid input: expected {}", stringify_primitive(&values[0])))]
                } else {
                    let joined = values.iter().map(stringify_primitive).collect::<Vec<_>>().join("|");
                    vec![Issue::new("invalid_value", format!("Invalid option: expected one of {joined}"))]
                }
            }
            Z::Array { item, min } => {
                let Value::Array(items) = value else { return vec![Issue::invalid_type("array", value)] };
                let mut out = Vec::new();
                for (i, v) in items.iter().enumerate() {
                    out.extend(item.issues(v).into_iter().map(|is| is.prefixed(Seg::Index(i))));
                }
                if let Some(n) = min
                    && items.len() < *n
                {
                    out.push(Issue { continues: true, ..Issue::new("too_small", format!("Too small: expected array to have >={n} items")) });
                }
                out
            }
            Z::Object(fields) => {
                let Value::Object(o) = value else { return vec![Issue::invalid_type("object", value)] };
                let mut out = Vec::new();
                for (key, schema) in fields {
                    let present = o.contains_key(*key);
                    let optional = schema.optional_in();
                    if !present && optional {
                        continue;
                    }
                    let field = o.get(*key).cloned().unwrap_or(Value::Undefined);
                    let issues = schema.issues(&field);
                    if issues.is_empty() && !present && !optional {
                        out.push(
                            Issue {
                                expected: Some("nonoptional".into()),
                                ..Issue::new("invalid_type", "Invalid input: expected nonoptional, received undefined".into())
                            }
                            .prefixed(Seg::Key((*key).into())),
                        );
                        continue;
                    }
                    out.extend(issues.into_iter().map(|i| i.prefixed(Seg::Key((*key).into()))));
                }
                out
            }
            Z::Record(schema) => {
                let Value::Object(o) = value else { return vec![Issue::invalid_type("record", value)] };
                let mut out = Vec::new();
                for (k, v) in o.iter() {
                    out.extend(schema.issues(v).into_iter().map(|i| i.prefixed(Seg::Key(k.to_string()))));
                }
                out
            }
            Z::Optional(inner) => {
                if value.is_undefined() {
                    vec![]
                } else {
                    inner.issues(value)
                }
            }
            Z::Union(options) => {
                if options.len() == 1 {
                    return options[0].issues(value);
                }
                let mut results = Vec::with_capacity(options.len());
                for option in options {
                    let issues = option.issues(value);
                    if issues.is_empty() {
                        return vec![];
                    }
                    results.push(issues);
                }
                let nonaborted: Vec<&Vec<Issue>> = results.iter().filter(|r| !aborted(r)).collect();
                if nonaborted.len() == 1 {
                    return nonaborted[0].clone();
                }
                vec![Issue::new("invalid_union", "Invalid input".into())]
            }
            Z::Disc { key, options } => {
                let Value::Object(o) = value else { return vec![Issue::invalid_type("object", value)] };
                let disc = o.get(*key).cloned().unwrap_or(Value::Undefined);
                match options.iter().find(|(v, _)| v.strict_eq(&disc)) {
                    Some((_, schema)) => schema.issues(value),
                    None => {
                        let opts = options.iter().map(|(v, _)| format!("'{}'", v.to_js_string())).collect::<Vec<_>>().join(" | ");
                        vec![
                            Issue::new("invalid_union", format!("Invalid discriminator value. Expected {opts}"))
                                .prefixed(Seg::Key((*key).into())),
                        ]
                    }
                }
            }
            Z::Lazy(inner) => inner.issues(value),
            Z::Preprocess(f, inner) => inner.issues(&f(value)),
            Z::Refine(inner, refine) => {
                let mut out = inner.issues(value);
                if !aborted(&out)
                    && let Some(message) = refine(value)
                {
                    out.push(Issue { continues: true, ..Issue::new("custom", message) });
                }
                out
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::val;

    #[test]
    fn unions_report_like_zod() {
        let z = Z::Union(vec![string(), number()]);
        let issues = z.issues(&val!(true));
        assert_eq!(issues.len(), 1);
        assert_eq!(issues[0].message, "Invalid input");
        // Only one branch failed on a continuable check: zod reports that branch's issue.
        let z = Z::Union(vec![trimmed_min(1), number()]);
        assert_eq!(z.issues(&val!("  ")).first().map(|i| i.message.clone()).as_deref(), Some("Too small: expected string to have >=1 characters"));
        let obj = object(vec![("code", string()), ("title", optional(string()))]);
        let issues = obj.issues(&val!({}));
        assert_eq!(issues[0].message, "Invalid input: expected string, received undefined");
        assert_eq!(issues[0].path, vec![Seg::Key("code".into())]);
    }
}
