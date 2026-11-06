//! The authoring DSL (port of `authoring/builders`): Rust builders that produce exactly the JSON
//! the TS builders produce, key order included (block keys decide AST node IDs).
//!
//! TS object literals become [`obj!`](crate::obj) literals; the chainable builders
//! (`Answer('x').path('y').pipe(...).match(...)`) become [`Ex`] methods, with `match` spelled
//! [`Ex::matches`] because `match` is a Rust keyword.
//!
//! ```
//! use forge_core::authoring::*;
//! use forge_core::obj;
//!
//! let name_field = field(obj! {
//!     "code": "fullName",
//!     "validWhen": [validation(obj! {
//!         "condition": self_().matches(condition::is_required()),
//!         "message": "Enter your full name",
//!     })],
//!     "variant": "testTextField",
//! });
//! assert_eq!(name_field.get("blockType").as_str(), Some("BlockType.field"));
//! ```

pub mod condition;
pub mod functions;
pub mod generator;
pub mod transformer;

/// `Effect` calls: effects are app functions (there are no built-ins), referenced by name.
pub mod effect {
    use crate::value::Value;

    /// A call to a registered effect, e.g. `effect::call("SaveAnswers", vec!["my-journey".into()])`.
    pub fn call(name: &str, arguments: Vec<Value>) -> Value {
        crate::authoring::function_call("FunctionType.Effect", name, arguments)
    }
}

pub use functions::{FunctionHandle, Functions};
use crate::value::{Map, Value};

/// Builds an ordered object [`Value`] from `"key": value` pairs; values are anything
/// `Into<Value>`, including nested `obj!` and `[a, b]` arrays of the same type.
#[macro_export]
macro_rules! obj {
    () => { $crate::value::Value::empty_object() };
    ($($key:literal : $value:expr),+ $(,)?) => {{
        let mut map = $crate::value::Map::new();
        $( map.insert(::std::sync::Arc::<str>::from($key), $crate::authoring::to_value($value)); )+
        $crate::value::Value::object(map)
    }};
}

/// Conversion used by [`obj!`]: lets arrays of builders and plain values mix.
pub fn to_value(v: impl IntoValue) -> Value {
    v.into_value()
}

/// Anything that can stand in an authored definition.
pub trait IntoValue {
    fn into_value(self) -> Value;
}

impl IntoValue for Value {
    fn into_value(self) -> Value {
        self
    }
}

impl IntoValue for &Value {
    fn into_value(self) -> Value {
        self.clone()
    }
}

impl IntoValue for Ex {
    fn into_value(self) -> Value {
        self.value
    }
}

impl IntoValue for &str {
    fn into_value(self) -> Value {
        Value::from(self)
    }
}

impl IntoValue for String {
    fn into_value(self) -> Value {
        Value::from(self)
    }
}

impl IntoValue for bool {
    fn into_value(self) -> Value {
        Value::Bool(self)
    }
}

impl IntoValue for i32 {
    fn into_value(self) -> Value {
        Value::from(self)
    }
}

impl IntoValue for i64 {
    fn into_value(self) -> Value {
        Value::from(self)
    }
}

impl IntoValue for f64 {
    fn into_value(self) -> Value {
        Value::Number(self)
    }
}

impl IntoValue for usize {
    fn into_value(self) -> Value {
        Value::from(self)
    }
}

impl<T: IntoValue> IntoValue for Vec<T> {
    fn into_value(self) -> Value {
        Value::array(self.into_iter().map(IntoValue::into_value).collect())
    }
}

impl<T: IntoValue, const N: usize> IntoValue for [T; N] {
    fn into_value(self) -> Value {
        Value::array(self.into_iter().map(IntoValue::into_value).collect())
    }
}

impl<T: IntoValue> IntoValue for Option<T> {
    fn into_value(self) -> Value {
        self.map_or(Value::Undefined, IntoValue::into_value)
    }
}

fn tag(t: &str) -> Value {
    Value::from(t)
}

/// `splitKey`: dotted keys become path segments.
fn split_key(key: &str) -> Vec<Value> {
    key.split('.').map(Value::from).collect()
}

/// Spreads `definition` and appends the given keys (`{ ...definition, type: X }`).
fn with_keys(definition: Value, keys: &[(&str, Value)]) -> Value {
    let mut map = match definition {
        Value::Object(o) => (*o).clone(),
        _ => Map::new(),
    };
    for (k, v) in keys {
        map.insert((*k).into(), v.clone());
    }
    Value::object(map)
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Kind {
    /// A `ReferenceBuilder`: `.path()` extends the path.
    Reference,
    /// Any other chainable expression: `.path()` wraps it as a reference base.
    Expression,
}

/// A chainable expression (`ReferenceBuilder`, `ExpressionBuilder`, `GeneratorBuilder`,
/// `IterableBuilder`).
#[derive(Clone, Debug)]
pub struct Ex {
    value: Value,
    negate: bool,
    kind: Kind,
}

impl Ex {
    fn reference(path: Vec<Value>) -> Self {
        Ex {
            value: Value::from_pairs([("type", tag("ExpressionType.Reference")), ("path", Value::array(path))]),
            negate: false,
            kind: Kind::Reference,
        }
    }

    /// `ExpressionBuilder.from` / `Literal`.
    pub fn from_value(value: impl IntoValue) -> Self {
        Ex { value: value.into_value(), negate: false, kind: Kind::Expression }
    }

    pub fn value(&self) -> &Value {
        &self.value
    }

    pub fn path(&self, key: &str) -> Ex {
        match self.kind {
            Kind::Reference => {
                let mut path = self.value.get("path").as_array().map(|p| (**p).clone()).unwrap_or_default();
                path.extend(split_key(key));
                Ex::reference(path)
            }
            Kind::Expression => Ex::from_value(Value::from_pairs([
                ("type", tag("ExpressionType.Reference")),
                ("base", self.value.clone()),
                ("path", Value::array(split_key(key))),
            ])),
        }
    }

    /// `.pipe(...steps)`.
    pub fn pipe(&self, steps: impl IntoIterator<Item = Value>) -> Ex {
        Ex::from_value(Value::from_pairs([
            ("type", tag("ExpressionType.Pipeline")),
            ("input", self.value.clone()),
            ("steps", Value::array(steps.into_iter().collect())),
        ]))
    }

    /// `.nullish(fallback)`; `None` omits the fallback.
    pub fn nullish(&self, fallback: impl IntoValue) -> Ex {
        let fallback = fallback.into_value();
        let mut map = Map::new();
        map.insert("type".into(), tag("ExpressionType.Nullish"));
        map.insert("input".into(), self.value.clone());
        if !fallback.is_undefined() {
            map.insert("fallback".into(), fallback);
        }
        Ex::from_value(Value::object(map))
    }

    /// `.each(iterator)`.
    pub fn each(&self, iterator: Value) -> Ex {
        let iterate = Value::from_pairs([
            ("type", tag("ExpressionType.Iterate")),
            ("input", self.value.clone()),
            ("iterator", iterator.clone()),
        ]);
        if iterator.get("type").as_str() == Some("IteratorType.Find") {
            return Ex::from_value(Value::from_pairs([
                ("type", tag("ExpressionType.Reference")),
                ("base", iterate),
                ("path", Value::array(vec![])),
            ]));
        }
        Ex::from_value(iterate)
    }

    /// `.match(condition)`.
    pub fn matches(&self, condition: Value) -> Value {
        Value::from_pairs([
            ("type", tag("PredicateType.Test")),
            ("subject", self.value.clone()),
            ("negate", Value::Bool(self.negate)),
            ("condition", condition),
        ])
    }

    /// `.not`.
    pub fn not(&self) -> Ex {
        Ex { negate: !self.negate, ..self.clone() }
    }
}

impl From<Ex> for Value {
    fn from(e: Ex) -> Value {
        e.value
    }
}

// References -------------------------------------------------------------------------------

pub fn post(key: &str) -> Ex {
    Ex::reference([vec![tag("post")], split_key(key)].concat())
}

pub fn params(key: &str) -> Ex {
    Ex::reference([vec![tag("params")], split_key(key)].concat())
}

pub fn query(key: &str) -> Ex {
    Ex::reference([vec![tag("query")], split_key(key)].concat())
}

pub fn data(key: &str) -> Ex {
    Ex::reference([vec![tag("data")], split_key(key)].concat())
}

pub fn session(key: &str) -> Ex {
    Ex::reference([vec![tag("session")], split_key(key)].concat())
}

/// `Answer(code)`: a string code (dotted keys split), or an expression code.
pub fn answer(target: impl IntoValue) -> Ex {
    let target = target.into_value();
    match &target {
        Value::String(s) => Ex::reference([vec![tag("answers")], split_key(s)].concat()),
        // A field block definition: answer its code.
        Value::Object(o) if o.get("blockType").and_then(Value::as_str) == Some("BlockType.field") => {
            answer(o.get("code").cloned().unwrap_or_default())
        }
        _ => Ex::reference(vec![tag("answers"), target]),
    }
}

/// `Self()`.
pub fn self_() -> Ex {
    Ex::reference(vec![tag("answers"), tag("@self")])
}

/// `Request.*`.
pub mod request {
    use super::*;

    pub fn url() -> Ex {
        Ex::reference(vec![tag("request"), tag("url")])
    }

    pub fn path() -> Ex {
        Ex::reference(vec![tag("request"), tag("path")])
    }

    pub fn method() -> Ex {
        Ex::reference(vec![tag("request"), tag("method")])
    }

    pub fn headers(name: &str) -> Ex {
        Ex::reference(vec![tag("request"), tag("headers"), Value::from(name)])
    }

    pub fn cookies(name: &str) -> Ex {
        Ex::reference(vec![tag("request"), tag("cookies"), Value::from(name)])
    }

    pub fn state(key: &str) -> Ex {
        Ex::reference([vec![tag("request"), tag("state")], split_key(key)].concat())
    }
}

/// `Item()` / `Item().parent` (`ScopedReferenceBuilder`).
#[derive(Clone, Copy, Debug)]
pub struct ItemRef {
    level: usize,
}

pub fn item() -> ItemRef {
    ItemRef { level: 0 }
}

impl ItemRef {
    pub fn parent(self) -> ItemRef {
        ItemRef { level: self.level + 1 }
    }

    pub fn path(self, key: &str) -> Ex {
        Ex::reference([vec![tag("@scope"), Value::from(self.level.to_string())], split_key(key)].concat())
    }

    pub fn value(self) -> Ex {
        Ex::reference(vec![tag("@scope"), Value::from(self.level.to_string())])
    }

    pub fn key(self) -> Ex {
        Ex::reference(vec![tag("@scope"), Value::from(self.level.to_string()), tag("@key")])
    }

    pub fn nullish(self, fallback: impl IntoValue) -> Ex {
        self.value().nullish(fallback)
    }
}

/// `Loop` / `Loop.Parent` (`LoopReferenceBuilder`).
#[derive(Clone, Copy, Debug)]
pub struct LoopRef {
    level: usize,
}

#[allow(non_upper_case_globals)]
pub const Loop: LoopRef = LoopRef { level: 0 };

impl LoopRef {
    fn at(self, prop: &str) -> Ex {
        Ex::reference(vec![tag("@loop"), Value::from(self.level.to_string()), Value::from(prop)])
    }

    pub fn parent(self) -> LoopRef {
        LoopRef { level: self.level + 1 }
    }

    pub fn index(self) -> Ex {
        self.at("index")
    }

    pub fn index0(self) -> Ex {
        self.at("index0")
    }

    pub fn revindex(self) -> Ex {
        self.at("revindex")
    }

    pub fn revindex0(self) -> Ex {
        self.at("revindex0")
    }

    pub fn first(self) -> Ex {
        self.at("first")
    }

    pub fn last(self) -> Ex {
        self.at("last")
    }

    pub fn length(self) -> Ex {
        self.at("length")
    }
}

// Values -----------------------------------------------------------------------------------

/// `Format(template, ...args)`.
pub fn format(template: impl IntoValue, args: impl IntoIterator<Item = Value>) -> Ex {
    let mut all = vec![template.into_value()];
    all.extend(args);
    generator::call("FormatString", all)
}

/// `Literal(value)`.
pub fn literal(value: impl IntoValue) -> Ex {
    Ex::from_value(value)
}

/// A function call expression (`{ type, name, arguments }`).
pub fn function_call(function_type: &str, name: &str, arguments: Vec<Value>) -> Value {
    Value::from_pairs([("type", tag(function_type)), ("name", Value::from(name)), ("arguments", Value::array(arguments))])
}

// Conditionals and matches -----------------------------------------------------------------

/// `when(predicate)` / `Conditional(...)` (`ConditionalExprBuilder`).
#[derive(Clone, Debug)]
pub struct When {
    predicate: Value,
    then: Value,
    otherwise: Value,
}

pub fn when(predicate: Value) -> When {
    When { predicate, then: Value::Bool(true), otherwise: Value::Bool(false) }
}

/// `Conditional({ when, then, else })`; pass `Value::Undefined` to keep the default `else`.
pub fn conditional(predicate: Value, then: impl IntoValue, otherwise: impl IntoValue) -> When {
    let w = when(predicate).then(then);
    let otherwise = otherwise.into_value();
    if otherwise.is_undefined() { w } else { w.otherwise(otherwise) }
}

impl When {
    pub fn then(self, value: impl IntoValue) -> When {
        When { then: value.into_value(), ..self }
    }

    pub fn otherwise(self, value: impl IntoValue) -> When {
        When { otherwise: value.into_value(), ..self }
    }

    pub fn build(&self) -> Value {
        Value::from_pairs([
            ("type", tag("ExpressionType.Conditional")),
            ("predicate", self.predicate.clone()),
            ("thenValue", self.then.clone()),
            ("elseValue", self.otherwise.clone()),
        ])
    }

    pub fn pipe(&self, steps: impl IntoIterator<Item = Value>) -> Ex {
        Ex::from_value(self.build()).pipe(steps)
    }

    pub fn nullish(&self, fallback: impl IntoValue) -> Ex {
        Ex::from_value(self.build()).nullish(fallback)
    }
}

impl IntoValue for When {
    fn into_value(self) -> Value {
        self.build()
    }
}

impl From<When> for Value {
    fn from(w: When) -> Value {
        w.build()
    }
}

/// `match(subject)` (`MatchExprBuilder`).
#[derive(Clone, Debug)]
pub struct Match {
    subject: Value,
    branches: Vec<Value>,
    otherwise: Value,
}

pub fn match_(subject: impl IntoValue) -> Match {
    Match { subject: subject.into_value(), branches: Vec::new(), otherwise: Value::Undefined }
}

impl Match {
    pub fn branch(mut self, condition: Value, value: impl IntoValue) -> Match {
        self.branches.push(Value::from_pairs([("condition", condition), ("value", value.into_value())]));
        self
    }

    pub fn case(mut self, expected: impl IntoValue, value: impl IntoValue) -> Match {
        self.branches.push(Value::from_pairs([("expected", expected.into_value()), ("value", value.into_value())]));
        self
    }

    pub fn otherwise(self, value: impl IntoValue) -> Match {
        Match { otherwise: value.into_value(), ..self }
    }

    pub fn build(&self) -> Value {
        let mut map = Map::new();
        map.insert("type".into(), tag("ExpressionType.Match"));
        map.insert("subject".into(), self.subject.clone());
        map.insert("branches".into(), Value::array(self.branches.clone()));
        if !self.otherwise.is_undefined() {
            map.insert("otherwise".into(), self.otherwise.clone());
        }
        Value::object(map)
    }

    pub fn pipe(&self, steps: impl IntoIterator<Item = Value>) -> Ex {
        Ex::from_value(self.build()).pipe(steps)
    }

    pub fn nullish(&self, fallback: impl IntoValue) -> Ex {
        Ex::from_value(self.build()).nullish(fallback)
    }
}

impl IntoValue for Match {
    fn into_value(self) -> Value {
        self.build()
    }
}

impl From<Match> for Value {
    fn from(m: Match) -> Value {
        m.build()
    }
}

// Combinators ------------------------------------------------------------------------------

fn is_condition_branch(v: &Value) -> bool {
    v.get("type").as_str().is_some_and(|t| t == "FunctionType.Condition" || t.starts_with("ConditionCombinatorType."))
}

fn combinator(name: &str, predicate_type: &str, combinator_type: &str, operands: Vec<Value>) -> Value {
    let conditions = operands.iter().filter(|o| is_condition_branch(o)).count();
    let ty = if conditions == 0 {
        predicate_type
    } else if conditions == operands.len() {
        combinator_type
    } else {
        panic!("{name}() cannot mix bare conditions with predicates — conditions take their subject from the surrounding match");
    };
    Value::from_pairs([("type", tag(ty)), ("operands", Value::array(operands))])
}

pub fn and(operands: Vec<Value>) -> Value {
    combinator("and", "PredicateType.And", "ConditionCombinatorType.And", operands)
}

pub fn or(operands: Vec<Value>) -> Value {
    combinator("or", "PredicateType.Or", "ConditionCombinatorType.Or", operands)
}

pub fn xor(operands: Vec<Value>) -> Value {
    combinator("xor", "PredicateType.Xor", "ConditionCombinatorType.Xor", operands)
}

pub fn not(operand: Value) -> Value {
    let ty = if is_condition_branch(&operand) { "ConditionCombinatorType.Not" } else { "PredicateType.Not" };
    Value::from_pairs([("type", tag(ty)), ("operand", operand)])
}

/// `Iterator.*`.
pub mod iterator {
    use super::*;

    pub fn map(yield_value: impl IntoValue) -> Value {
        Value::from_pairs([("type", tag("IteratorType.Map")), ("yield", yield_value.into_value())])
    }

    fn with_predicate(ty: &str, predicate: Value) -> Value {
        Value::from_pairs([("type", tag(ty)), ("predicate", predicate)])
    }

    pub fn filter(predicate: Value) -> Value {
        with_predicate("IteratorType.Filter", predicate)
    }

    pub fn find(predicate: Value) -> Value {
        with_predicate("IteratorType.Find", predicate)
    }

    pub fn some(predicate: Value) -> Value {
        with_predicate("IteratorType.Some", predicate)
    }

    pub fn every(predicate: Value) -> Value {
        with_predicate("IteratorType.Every", predicate)
    }

    pub fn count(predicate: Value) -> Value {
        with_predicate("IteratorType.Count", predicate)
    }
}

// Hooks ------------------------------------------------------------------------------------

pub fn submit(definition: Value) -> Value {
    with_keys(definition, &[("type", tag("HookType.Submit"))])
}

pub fn access(definition: Value) -> Value {
    with_keys(definition, &[("type", tag("HookType.Access"))])
}

pub fn validation(definition: Value) -> Value {
    with_keys(definition, &[("type", tag("ExpressionType.Validation"))])
}

pub fn tie_breaker(definition: Value) -> Value {
    with_keys(definition, &[("type", tag("ExpressionType.TieBreaker"))])
}

pub fn redirect(definition: Value) -> Value {
    with_keys(definition, &[("type", tag("Outcome.Redirect"))])
}

pub fn throw_error(definition: Value) -> Value {
    with_keys(definition, &[("type", tag("Outcome.ThrowError"))])
}

// Structures -------------------------------------------------------------------------------

pub fn block(definition: Value) -> Value {
    with_keys(definition, &[("type", tag("StructureType.Block")), ("blockType", tag("BlockType.basic"))])
}

pub fn field(definition: Value) -> Value {
    with_keys(definition, &[("type", tag("StructureType.Block")), ("blockType", tag("BlockType.field"))])
}

pub fn step(definition: Value) -> Value {
    with_keys(definition, &[("type", tag("StructureType.Step"))])
}

pub fn journey(definition: Value) -> Value {
    with_keys(definition, &[("type", tag("StructureType.Journey"))])
}

/// Array spread (`[...a, b, ...c]`): array parts are flattened in place, other parts appended.
///
/// ```
/// use forge_core::authoring::*;
/// use forge_core::{Value, obj};
///
/// let rules = concat([
///     Value::array(vec![validation(obj! { "message": "a" })]),
///     validation(obj! { "message": "b" }),
/// ]);
/// assert_eq!(rules.as_array().map(|r| r.len()), Some(2));
/// ```
pub fn concat(parts: impl IntoIterator<Item = Value>) -> Value {
    let mut out = Vec::new();
    for part in parts {
        match part {
            Value::Array(items) => out.extend(items.iter().cloned()),
            other => out.push(other),
        }
    }
    Value::array(out)
}

/// A component builder (`component(variant, options)`): `{ ...prepare(props), variant }` then
/// `block`/`field`.
#[derive(Clone)]
pub struct Component {
    pub variant: &'static str,
    pub field: bool,
    pub prepare: Option<fn(Value) -> Value>,
}

impl Component {
    pub const fn basic(variant: &'static str) -> Self {
        Self { variant, field: false, prepare: None }
    }

    pub const fn field(variant: &'static str) -> Self {
        Self { variant, field: true, prepare: None }
    }

    pub const fn with_prepare(self, prepare: fn(Value) -> Value) -> Self {
        Self { prepare: Some(prepare), ..self }
    }

    pub fn build(&self, props: Value) -> Value {
        let props = if props.is_undefined() { Value::empty_object() } else { props };
        let prepared = match self.prepare {
            Some(p) => p(props),
            None => props,
        };
        let definition = with_keys(prepared, &[("variant", Value::from(self.variant))]);
        if self.field { field(definition) } else { block(definition) }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::val;

    #[test]
    fn builders_match_typescript_json() {
        let pred = answer("employment_status").matches(condition::equals("employed"));
        assert_eq!(
            pred,
            val!({"type": "PredicateType.Test",
                  "subject": {"type": "ExpressionType.Reference", "path": ["answers", "employment_status"]},
                  "negate": false,
                  "condition": {"type": "FunctionType.Condition", "name": "Equals", "arguments": ["employed"]}})
        );
        let find = data("items").each(iterator::find(item().path("id").matches(condition::equals(params("id"))))).path("name");
        assert_eq!(find.value().get("path"), val!(["name"]));
        assert_eq!(find.value().get("base").get("base").get("type").as_str(), Some("ExpressionType.Iterate"));
        let s = step(obj! { "path": "/a", "title": "A" });
        assert_eq!(serde_json::to_string(&s).unwrap(), r#"{"path":"/a","title":"A","type":"StructureType.Step"}"#);
        assert_eq!(format("Hi %1", [answer("name").into()]).value().get("name").as_str(), Some("FormatString"));
    }
}
