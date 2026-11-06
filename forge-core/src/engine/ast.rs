//! The compiler's AST: authored journey JSON turned into typed, ID'd nodes.
//!
//! Port of `engine/chassis/compilation/ast`. Node creation order mirrors the TypeScript
//! `NodeFactory` exactly - children are created before their parent takes an ID, and
//! properties are visited in the same order - so `compile_ast:N` and `template:N` IDs match
//! the TS engine. Those IDs surface in render output (block IDs), which keeps the two engines
//! directly comparable.

use std::collections::HashMap;
use std::sync::Arc;

use indexmap::IndexMap;

use crate::engine::dsl::format_path;
use crate::engine::dsl::zod::Seg;
use crate::engine::errors::ForgeError;
use crate::value::{Map, Value};

pub type NodeId = Arc<str>;
pub type Props = IndexMap<Arc<str>, Prop>;

/// A property value inside a node: a literal, a container, or a nested node.
#[derive(Clone, Debug)]
pub enum Prop {
    /// A primitive literal (`undefined`, `null`, boolean, number, string).
    Lit(Value),
    Array(Vec<Prop>),
    Object(Props),
    Node(Arc<Node>),
}

impl Prop {
    pub fn undefined() -> Self {
        Prop::Lit(Value::Undefined)
    }

    pub fn is_undefined(&self) -> bool {
        matches!(self, Prop::Lit(Value::Undefined))
    }

    pub fn as_node(&self) -> Option<&Arc<Node>> {
        match self {
            Prop::Node(n) => Some(n),
            _ => None,
        }
    }

    pub fn as_array(&self) -> Option<&[Prop]> {
        match self {
            Prop::Array(items) => Some(items),
            _ => None,
        }
    }

    pub fn as_object(&self) -> Option<&Props> {
        match self {
            Prop::Object(o) => Some(o),
            _ => None,
        }
    }

    pub fn as_str(&self) -> Option<&str> {
        match self {
            Prop::Lit(Value::String(s)) => Some(s),
            _ => None,
        }
    }

    pub fn as_lit(&self) -> Option<&Value> {
        match self {
            Prop::Lit(v) => Some(v),
            _ => None,
        }
    }

    /// True when the value contains no nodes at any depth (`isDeepStaticValue`).
    pub fn is_static(&self) -> bool {
        match self {
            Prop::Lit(_) => true,
            Prop::Array(items) => items.iter().all(Prop::is_static),
            Prop::Object(o) => o.values().all(Prop::is_static),
            Prop::Node(_) => false,
        }
    }

    /// The literal value of a static prop. Containers are rebuilt each call.
    pub fn to_static_value(&self) -> Value {
        match self {
            Prop::Lit(v) => v.clone(),
            Prop::Array(items) => Value::array(items.iter().map(Prop::to_static_value).collect()),
            Prop::Object(o) => Value::object(o.iter().map(|(k, v)| (k.clone(), v.to_static_value())).collect()),
            Prop::Node(_) => Value::Undefined,
        }
    }

    /// Visits every node reachable from this prop, not descending into nodes themselves.
    pub fn for_each_node(&self, f: &mut impl FnMut(&Arc<Node>)) {
        match self {
            Prop::Lit(_) => {}
            Prop::Array(items) => items.iter().for_each(|p| p.for_each_node(f)),
            Prop::Object(o) => o.values().for_each(|p| p.for_each_node(f)),
            Prop::Node(n) => f(n),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum ExprKind {
    Reference,
    Pipeline,
    Nullish,
    Conditional,
    Match,
    Iterate,
    Validation,
    TieBreaker,
    Condition,
    Transformer,
    Generator,
    Effect,
}

impl ExprKind {
    pub fn tag(self) -> &'static str {
        match self {
            ExprKind::Reference => "ExpressionType.Reference",
            ExprKind::Pipeline => "ExpressionType.Pipeline",
            ExprKind::Nullish => "ExpressionType.Nullish",
            ExprKind::Conditional => "ExpressionType.Conditional",
            ExprKind::Match => "ExpressionType.Match",
            ExprKind::Iterate => "ExpressionType.Iterate",
            ExprKind::Validation => "ExpressionType.Validation",
            ExprKind::TieBreaker => "ExpressionType.TieBreaker",
            ExprKind::Condition => "FunctionType.Condition",
            ExprKind::Transformer => "FunctionType.Transformer",
            ExprKind::Generator => "FunctionType.Generator",
            ExprKind::Effect => "FunctionType.Effect",
        }
    }

    pub fn is_function(self) -> bool {
        matches!(self, ExprKind::Condition | ExprKind::Transformer | ExprKind::Generator | ExprKind::Effect)
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum PredKind {
    Test,
    And,
    Or,
    Xor,
    Not,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum HookKind {
    Access,
    Submit,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum OutcomeKind {
    Redirect,
    ThrowError,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum BlockKind {
    Field,
    Basic,
}

impl BlockKind {
    pub fn tag(self) -> &'static str {
        match self {
            BlockKind::Field => "BlockType.field",
            BlockKind::Basic => "BlockType.basic",
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum NodeKind {
    Journey,
    Step,
    Block { variant: Arc<str>, block: BlockKind },
    Expr(ExprKind),
    Predicate(PredKind),
    Hook(HookKind),
    Outcome(OutcomeKind),
}

#[derive(Debug)]
pub struct Node {
    pub id: NodeId,
    /// Template nodes are copies made for iterator bodies; they are never registered.
    pub template: bool,
    pub kind: NodeKind,
    pub props: Props,
    /// Formatted DSL path for diagnostics (`__source.formattedPath`), when known.
    pub source_path: Option<Arc<str>>,
}

impl Node {
    pub fn prop(&self, key: &str) -> Option<&Prop> {
        self.props.get(key)
    }

    pub fn node_prop(&self, key: &str) -> Option<&Arc<Node>> {
        self.props.get(key).and_then(Prop::as_node)
    }

    pub fn str_prop(&self, key: &str) -> Option<&str> {
        self.props.get(key).and_then(Prop::as_str)
    }

    pub fn expr_kind(&self) -> Option<ExprKind> {
        match self.kind {
            NodeKind::Expr(k) => Some(k),
            _ => None,
        }
    }

    pub fn is_field_block(&self) -> bool {
        matches!(self.kind, NodeKind::Block { block: BlockKind::Field, .. })
    }

    pub fn is_block(&self) -> bool {
        matches!(self.kind, NodeKind::Block { .. })
    }

    pub fn variant(&self) -> Option<&Arc<str>> {
        match &self.kind {
            NodeKind::Block { variant, .. } => Some(variant),
            _ => None,
        }
    }

    pub fn children(&self, key: &str) -> Vec<Arc<Node>> {
        match self.props.get(key) {
            Some(Prop::Array(items)) => items.iter().filter_map(|p| p.as_node().cloned()).collect(),
            Some(Prop::Node(n)) => vec![n.clone()],
            _ => Vec::new(),
        }
    }
}

/// `compile_ast` and `template` ID counters (`NodeIDGenerator`).
#[derive(Default)]
pub struct NodeIdGenerator {
    ast: u32,
    template: u32,
}

impl NodeIdGenerator {
    pub fn next_ast(&mut self) -> NodeId {
        self.ast += 1;
        format!("compile_ast:{}", self.ast).into()
    }

    pub fn next_template(&mut self) -> NodeId {
        self.template += 1;
        format!("template:{}", self.template).into()
    }
}

const NODE_TYPES: &[&str] = &[
    "StructureType.Journey",
    "StructureType.Step",
    "StructureType.Block",
    "ExpressionType.Reference",
    "ExpressionType.Pipeline",
    "ExpressionType.Nullish",
    "ExpressionType.Conditional",
    "ExpressionType.Match",
    "ExpressionType.Iterate",
    "ExpressionType.Validation",
    "ExpressionType.TieBreaker",
    "PredicateType.Test",
    "PredicateType.Not",
    "PredicateType.And",
    "PredicateType.Or",
    "PredicateType.Xor",
    "FunctionType.Condition",
    "FunctionType.Transformer",
    "FunctionType.Generator",
    "FunctionType.Effect",
    "HookType.Access",
    "HookType.Submit",
    "Outcome.Redirect",
    "Outcome.ThrowError",
    "ConditionCombinatorType.And",
    "ConditionCombinatorType.Or",
    "ConditionCombinatorType.Xor",
    "ConditionCombinatorType.Not",
    "IteratorType.Map",
    "IteratorType.Filter",
    "IteratorType.Find",
    "IteratorType.Some",
    "IteratorType.Every",
    "IteratorType.Count",
];

/// Types recognised as expressions inside reference paths (`isExpression`).
const EXPRESSION_TYPES: &[&str] = &[
    "ExpressionType.Reference",
    "ExpressionType.Pipeline",
    "ExpressionType.Nullish",
    "ExpressionType.Conditional",
    "ExpressionType.Match",
    "ExpressionType.Iterate",
    "ExpressionType.Validation",
    "ExpressionType.TieBreaker",
    "PredicateType.Test",
    "PredicateType.Not",
    "PredicateType.And",
    "PredicateType.Or",
    "PredicateType.Xor",
    "ConditionCombinatorType.And",
    "ConditionCombinatorType.Or",
    "ConditionCombinatorType.Xor",
    "ConditionCombinatorType.Not",
    "FunctionType.Condition",
    "FunctionType.Transformer",
    "FunctionType.Generator",
    "FunctionType.Effect",
    "Outcome.Redirect",
    "Outcome.ThrowError",
];

fn type_of(json: &Value) -> Option<&str> {
    match json {
        Value::Object(o) => o.get("type").and_then(Value::as_str),
        _ => None,
    }
}

fn is_node_json(json: &Value) -> bool {
    type_of(json).is_some_and(|t| NODE_TYPES.contains(&t))
}

fn is_expression_json(json: &Value) -> bool {
    type_of(json).is_some_and(|t| EXPRESSION_TYPES.contains(&t))
}

/// Builds AST nodes from authored JSON (`NodeFactory`).
pub struct NodeFactory {
    pub ids: NodeIdGenerator,
    /// The authored root and each object's DSL path in it (TS stamps `__source` on every
    /// object of the finalised tree), by object identity.
    sources: Option<(Value, HashMap<usize, Vec<Seg>>)>,
}

type BuildResult<T> = Result<T, ForgeError>;

fn invalid(message: impl Into<String>) -> ForgeError {
    ForgeError::InvalidNode { message: message.into() }
}

impl Default for NodeFactory {
    fn default() -> Self {
        Self::new()
    }
}

impl NodeFactory {
    pub fn new() -> Self {
        Self { ids: NodeIdGenerator::default(), sources: None }
    }

    /// A factory that gives every node built from `root` its formatted DSL path.
    pub fn for_root(root: &Value) -> Self {
        fn walk(v: &Value, path: &mut Vec<Seg>, out: &mut HashMap<usize, Vec<Seg>>) {
            match v {
                Value::Object(o) => {
                    out.entry(Arc::as_ptr(o) as usize).or_insert_with(|| path.clone());
                    for (k, x) in o.iter() {
                        path.push(Seg::Key(k.to_string()));
                        walk(x, path, out);
                        path.pop();
                    }
                }
                Value::Array(items) => {
                    for (i, x) in items.iter().enumerate() {
                        path.push(Seg::Index(i));
                        walk(x, path, out);
                        path.pop();
                    }
                }
                _ => {}
            }
        }
        let mut map = HashMap::new();
        walk(root, &mut Vec::new(), &mut map);
        Self { ids: NodeIdGenerator::default(), sources: Some((root.clone(), map)) }
    }

    fn source_of(&self, json: &Value) -> Option<Arc<str>> {
        let (root, map) = self.sources.as_ref()?;
        let Value::Object(o) = json else { return None };
        let path = map.get(&(Arc::as_ptr(o) as usize))?;
        Some(format_path(root, path).into())
    }

    fn node(&mut self, kind: NodeKind, props: Props) -> Arc<Node> {
        Arc::new(Node { id: self.ids.next_ast(), template: false, kind, props, source_path: None })
    }

    pub fn create_node(&mut self, json: &Value) -> BuildResult<Arc<Node>> {
        let mut node = self.create_node_inner(json)?;
        if let Some(source) = self.source_of(json)
            && let Some(n) = Arc::get_mut(&mut node)
        {
            n.source_path = Some(source);
        }
        Ok(node)
    }

    fn create_node_inner(&mut self, json: &Value) -> BuildResult<Arc<Node>> {
        let Value::Object(obj) = json else {
            return Err(invalid(format!("Invalid node: expected object, got {}", json.type_of())));
        };
        let Some(ty) = obj.get("type").and_then(Value::as_str) else {
            return Err(ForgeError::UnknownNodeType { node_type: None });
        };
        match ty {
            "StructureType.Journey" => self.journey(obj),
            "StructureType.Step" => self.step(obj),
            "StructureType.Block" => self.block(obj),
            "ExpressionType.Reference" => self.reference(obj),
            "ExpressionType.Pipeline" => self.pipeline(obj),
            "ExpressionType.Nullish" => self.nullish(obj),
            "ExpressionType.Conditional" => self.conditional(obj),
            "ExpressionType.Match" => self.match_expr(obj),
            "ExpressionType.Iterate" => self.iterate(obj),
            "ExpressionType.Validation" => self.validation(obj),
            "ExpressionType.TieBreaker" => self.tie_breaker(obj),
            "PredicateType.Test" => self.test_predicate(obj),
            "PredicateType.Not" => self.not_predicate(obj),
            "PredicateType.And" => self.nary_predicate(obj, PredKind::And),
            "PredicateType.Or" => self.nary_predicate(obj, PredKind::Or),
            "PredicateType.Xor" => self.nary_predicate(obj, PredKind::Xor),
            "FunctionType.Condition" => self.function(obj, ExprKind::Condition),
            "FunctionType.Transformer" => self.function(obj, ExprKind::Transformer),
            "FunctionType.Generator" => self.function(obj, ExprKind::Generator),
            "FunctionType.Effect" => self.function(obj, ExprKind::Effect),
            "HookType.Access" => self.access_hook(obj),
            "HookType.Submit" => self.submit_hook(obj),
            "Outcome.Redirect" => self.redirect(obj),
            "Outcome.ThrowError" => self.throw_error(obj),
            t if t.starts_with("ConditionCombinatorType.") => Err(invalid(
                "Condition combinators can only appear inside a match expression branch condition",
            )),
            t if t.starts_with("IteratorType.") => Err(invalid(
                "Iterator configurations can only appear inside the iterator of an Iterate expression",
            )),
            other => Err(ForgeError::UnknownNodeType { node_type: Some(other.to_string()) }),
        }
    }

    /// `transformValue`: recurse into containers, turning recognised node objects into nodes.
    pub fn transform(&mut self, json: &Value) -> BuildResult<Prop> {
        Ok(match json {
            Value::Array(items) => Prop::Array(items.iter().map(|i| self.transform(i)).collect::<BuildResult<_>>()?),
            Value::Object(o) => {
                if is_node_json(json) {
                    Prop::Node(self.create_node(json)?)
                } else {
                    let mut props = Props::new();
                    for (k, v) in o.iter() {
                        props.insert(k.clone(), self.transform(v)?);
                    }
                    Prop::Object(props)
                }
            }
            other => Prop::Lit(other.clone()),
        })
    }

    fn get<'a>(obj: &'a Map, key: &str) -> Option<&'a Value> {
        obj.get(key).filter(|v| !v.is_undefined())
    }

    fn journey(&mut self, obj: &Map) -> BuildResult<Arc<Node>> {
        let code = Self::get(obj, "code").ok_or_else(|| invalid("Journey requires a code property"))?;
        let path = Self::get(obj, "path").ok_or_else(|| invalid("Journey requires a path property"))?;
        let title = Self::get(obj, "title").ok_or_else(|| invalid("Journey requires a title property"))?;
        let mut props = Props::new();
        props.insert("code".into(), Prop::Lit(code.clone()));
        props.insert("path".into(), Prop::Lit(path.clone()));
        props.insert("title".into(), self.transform(title)?);
        for key in ["description", "onAccess", "steps", "children", "view", "metadata"] {
            if let Some(v) = Self::get(obj, key) {
                props.insert(key.into(), self.transform(v)?);
            }
        }
        if let Some(data) = Self::get(obj, "data") {
            props.insert("data".into(), static_prop(data));
        }
        if let Some(r) = Self::get(obj, "reachability") {
            let mut reach = Props::new();
            match r.get("resumeWhen") {
                Value::Bool(true) => {
                    reach.insert("resumeWhen".into(), Prop::Lit(Value::Bool(true)));
                }
                Value::Undefined | Value::Bool(false) => {}
                expr => {
                    reach.insert("resumeWhen".into(), Prop::Node(self.create_node(&expr)?));
                }
            }
            for key in ["unreachableRedirect", "disableReachabilityChecks"] {
                let v = r.get(key);
                if !v.is_undefined() {
                    reach.insert(key.into(), Prop::Lit(v));
                }
            }
            props.insert("reachability".into(), Prop::Object(reach));
        }
        Ok(self.node(NodeKind::Journey, props))
    }

    fn step(&mut self, obj: &Map) -> BuildResult<Arc<Node>> {
        let path = Self::get(obj, "path").ok_or_else(|| invalid("Step requires a path property"))?;
        let title = Self::get(obj, "title").ok_or_else(|| invalid("Step requires a title property"))?;
        let mut props = Props::new();
        props.insert("path".into(), Prop::Lit(path.clone()));
        props.insert("title".into(), self.transform(title)?);
        if let Some(v) = Self::get(obj, "onAccess") {
            props.insert("onAccess".into(), self.transform(v)?);
        }
        if let Some(v) = Self::get(obj, "code") {
            props.insert("code".into(), Prop::Lit(v.clone()));
        }
        if let Some(v) = Self::get(obj, "onSubmission") {
            props.insert("onSubmission".into(), self.transform(v)?);
        }
        if let Some(Value::Array(entries)) = Self::get(obj, "validateOnEntry") {
            let mut out = Vec::new();
            for entry in entries.iter() {
                let when = entry.get("when");
                if matches!(when, Value::Bool(false)) {
                    continue;
                }
                let mut e = Props::new();
                e.insert("groups".into(), static_prop(&entry.get("groups")));
                let when = match when {
                    Value::Bool(true) => Prop::Lit(Value::Bool(true)),
                    other => Prop::Node(self.create_node(&other)?),
                };
                e.insert("when".into(), when);
                out.push(Prop::Object(e));
            }
            props.insert("validateOnEntry".into(), Prop::Array(out));
        }
        for key in ["blocks", "description", "view"] {
            if let Some(v) = Self::get(obj, key) {
                props.insert(key.into(), self.transform(v)?);
            }
        }
        if let Some(r) = Self::get(obj, "reachability") {
            let mut reach = Props::new();
            match r.get("entryWhen") {
                Value::Bool(true) => {
                    reach.insert("entryWhen".into(), Prop::Lit(Value::Bool(true)));
                }
                Value::Undefined | Value::Bool(false) => {}
                expr => {
                    reach.insert("entryWhen".into(), Prop::Node(self.create_node(&expr)?));
                }
            }
            if let Value::Array(tbs) = r.get("tieBreakers")
                && tbs.iter().all(|t| type_of(t) == Some("ExpressionType.TieBreaker"))
            {
                reach.insert("tieBreakers".into(), self.transform(&r.get("tieBreakers"))?);
            }
            props.insert("reachability".into(), Prop::Object(reach));
        }
        if let Some(v) = Self::get(obj, "backlink") {
            props.insert("backlink".into(), Prop::Lit(v.clone()));
        }
        if let Some(v) = Self::get(obj, "metadata") {
            props.insert("metadata".into(), self.transform(v)?);
        }
        if let Some(v) = Self::get(obj, "data") {
            props.insert("data".into(), static_prop(v));
        }
        if let Some(v) = Self::get(obj, "validWhen") {
            props.insert("validWhen".into(), self.transform(v)?);
        }
        if let Some(v) = Self::get(obj, "cleardownFieldCodes") {
            props.insert("cleardownFieldCodes".into(), static_prop(v));
        }
        Ok(self.node(NodeKind::Step, props))
    }

    fn block(&mut self, obj: &Map) -> BuildResult<Arc<Node>> {
        let variant: Arc<str> = obj.get("variant").and_then(Value::as_str).unwrap_or_default().into();
        let field = obj.get("blockType").and_then(Value::as_str) == Some("BlockType.field");
        if field && Self::get(obj, "code").is_none() {
            return Err(invalid("Field block requires a code property"));
        }
        let mut props = Props::new();
        for (k, v) in obj.iter() {
            if k.as_ref() == "variant" || k.as_ref() == "type" {
                continue;
            }
            props.insert(k.clone(), self.transform(v)?);
        }
        if let Some(metadata) = Self::get(obj, "metadata") {
            props.insert("metadata".into(), static_prop(metadata));
        }
        let block = if field { BlockKind::Field } else { BlockKind::Basic };
        Ok(self.node(NodeKind::Block { variant, block }, props))
    }

    fn reference(&mut self, obj: &Map) -> BuildResult<Arc<Node>> {
        let base = match Self::get(obj, "base") {
            Some(b) => Some(self.transform(b)?),
            None => None,
        };
        let path = obj.get("path").cloned().unwrap_or_default();
        let Value::Array(segments) = &path else {
            return Err(invalid("Reference path must be a non-empty array"));
        };
        if base.is_none() && segments.is_empty() {
            return Err(invalid("Reference path must be a non-empty array"));
        }
        let mut out = Vec::new();
        for segment in segments.iter() {
            if is_expression_json(segment) {
                out.push(self.transform(segment)?);
            } else if matches!(segment, Value::String(_) | Value::Number(_)) {
                out.push(Prop::Lit(segment.clone()));
            } else {
                return Err(invalid("Reference path segments must be strings, numbers, or expressions"));
            }
        }
        let mut props = Props::new();
        props.insert("path".into(), Prop::Array(out));
        props.insert("base".into(), base.unwrap_or_else(Prop::undefined));
        Ok(self.node(NodeKind::Expr(ExprKind::Reference), props))
    }

    fn pipeline(&mut self, obj: &Map) -> BuildResult<Arc<Node>> {
        let input = self.transform(&obj.get("input").cloned().unwrap_or_default())?;
        let mut steps = Vec::new();
        if let Some(Value::Array(s)) = obj.get("steps") {
            for step in s.iter() {
                steps.push(self.transform(step)?);
            }
        }
        let mut props = Props::new();
        props.insert("input".into(), input);
        props.insert("steps".into(), Prop::Array(steps));
        Ok(self.node(NodeKind::Expr(ExprKind::Pipeline), props))
    }

    fn conditional(&mut self, obj: &Map) -> BuildResult<Arc<Node>> {
        let predicate = Self::get(obj, "predicate").ok_or_else(|| invalid("Conditional expression requires a predicate"))?;
        let predicate = Prop::Node(self.create_node(predicate)?);
        let then_value = match Self::get(obj, "thenValue") {
            Some(v) => self.transform(v)?,
            None => Prop::Lit(Value::Bool(true)),
        };
        let else_value = match Self::get(obj, "elseValue") {
            Some(v) => self.transform(v)?,
            None => Prop::Lit(Value::Bool(false)),
        };
        let mut props = Props::new();
        props.insert("predicate".into(), predicate);
        props.insert("thenValue".into(), then_value);
        props.insert("elseValue".into(), else_value);
        Ok(self.node(NodeKind::Expr(ExprKind::Conditional), props))
    }

    fn iterate(&mut self, obj: &Map) -> BuildResult<Arc<Node>> {
        let input = self.transform(&obj.get("input").cloned().unwrap_or_default())?;
        let iterator = obj.get("iterator").cloned().unwrap_or_default();
        let iter_type = iterator.get("type");
        let mut iter_props = Props::new();
        iter_props.insert("type".into(), Prop::Lit(iter_type.clone()));
        match iter_type.as_str() {
            Some("IteratorType.Map") => {
                let built = self.transform(&iterator.get("yield"))?;
                iter_props.insert("yieldTemplate".into(), self.compile_template(&built));
            }
            Some(
                "IteratorType.Filter" | "IteratorType.Find" | "IteratorType.Some" | "IteratorType.Every"
                | "IteratorType.Count",
            ) => {
                let built = self.transform(&iterator.get("predicate"))?;
                iter_props.insert("predicateTemplate".into(), self.compile_template(&built));
            }
            _ => {}
        }
        let mut props = Props::new();
        props.insert("input".into(), input);
        props.insert("iterator".into(), Prop::Object(iter_props));
        Ok(self.node(NodeKind::Expr(ExprKind::Iterate), props))
    }

    fn validation(&mut self, obj: &Map) -> BuildResult<Arc<Node>> {
        let condition = obj.get("condition").cloned().unwrap_or_default();
        let condition = Prop::Node(self.create_node(&condition)?);
        let message = obj.get("message").cloned().unwrap_or_default();
        let message = if message.truthy() { self.transform(&message)? } else { Prop::Lit(Value::string("")) };
        let mut props = Props::new();
        props.insert("condition".into(), condition);
        props.insert("message".into(), message);
        let submission_only = Self::get(obj, "submissionOnly").cloned().unwrap_or(Value::Bool(false));
        props.insert("submissionOnly".into(), Prop::Lit(submission_only));
        let groups = match obj.get("groups") {
            Some(g) if !g.is_nullish() => static_prop(g),
            _ => Prop::Array(vec![Prop::Lit(Value::string("default"))]),
        };
        props.insert("groups".into(), groups);
        if let Some(details) = Self::get(obj, "details").filter(|d| d.truthy()) {
            props.insert("details".into(), self.transform(details)?);
        }
        Ok(self.node(NodeKind::Expr(ExprKind::Validation), props))
    }

    fn tie_breaker(&mut self, obj: &Map) -> BuildResult<Arc<Node>> {
        let mut props = Props::new();
        props.insert("priority".into(), Prop::Lit(obj.get("priority").cloned().unwrap_or_default()));
        if let Some(when) = Self::get(obj, "when") {
            props.insert("when".into(), Prop::Node(self.create_node(when)?));
        }
        Ok(self.node(NodeKind::Expr(ExprKind::TieBreaker), props))
    }

    fn function(&mut self, obj: &Map, kind: ExprKind) -> BuildResult<Arc<Node>> {
        let mut args = Vec::new();
        if let Some(Value::Array(a)) = obj.get("arguments") {
            for arg in a.iter() {
                args.push(self.transform(arg)?);
            }
        }
        let mut props = Props::new();
        props.insert("name".into(), Prop::Lit(obj.get("name").cloned().unwrap_or_default()));
        props.insert("arguments".into(), Prop::Array(args));
        Ok(self.node(NodeKind::Expr(kind), props))
    }

    fn match_expr(&mut self, obj: &Map) -> BuildResult<Arc<Node>> {
        let subject = obj.get("subject").cloned().unwrap_or_default();
        if subject.is_undefined() {
            return Err(invalid("Match expression requires a subject"));
        }
        let branches = match obj.get("branches") {
            Some(Value::Array(b)) if !b.is_empty() => b.clone(),
            _ => return Err(invalid("Match expression requires at least one branch")),
        };
        let mut compiled = Vec::new();
        for branch in branches.iter() {
            let mut bp = Props::new();
            let condition = branch.get("condition");
            if branch.as_object().is_some_and(|o| o.contains_key("condition")) {
                bp.insert("predicate".into(), Prop::Node(self.expand_condition(&condition, &subject)?));
            } else {
                bp.insert("expected".into(), self.transform(&branch.get("expected"))?);
            }
            bp.insert("value".into(), self.transform(&branch.get("value"))?);
            compiled.push(Prop::Object(bp));
        }
        let mut props = Props::new();
        props.insert("subject".into(), self.transform(&subject)?);
        props.insert("branches".into(), Prop::Array(compiled));
        if let Some(otherwise) = Self::get(obj, "otherwise") {
            props.insert("otherwise".into(), self.transform(otherwise)?);
        }
        Ok(self.node(NodeKind::Expr(ExprKind::Match), props))
    }

    fn expand_condition(&mut self, condition: &Value, subject: &Value) -> BuildResult<Arc<Node>> {
        match type_of(condition) {
            Some("ConditionCombinatorType.Not") => {
                let operand = self.expand_condition(&condition.get("operand"), subject)?;
                let mut props = Props::new();
                props.insert("operand".into(), Prop::Node(operand));
                Ok(self.node(NodeKind::Predicate(PredKind::Not), props))
            }
            Some(t @ ("ConditionCombinatorType.And" | "ConditionCombinatorType.Or" | "ConditionCombinatorType.Xor")) => {
                let kind = match t {
                    "ConditionCombinatorType.And" => PredKind::And,
                    "ConditionCombinatorType.Or" => PredKind::Or,
                    _ => PredKind::Xor,
                };
                let mut operands = Vec::new();
                if let Value::Array(ops) = condition.get("operands") {
                    for op in ops.iter() {
                        operands.push(Prop::Node(self.expand_condition(op, subject)?));
                    }
                }
                let mut props = Props::new();
                props.insert("operands".into(), Prop::Array(operands));
                Ok(self.node(NodeKind::Predicate(kind), props))
            }
            _ => {
                let mut props = Props::new();
                props.insert("subject".into(), self.transform(subject)?);
                props.insert("condition".into(), Prop::Node(self.create_node(condition)?));
                props.insert("negate".into(), Prop::Lit(Value::Bool(false)));
                Ok(self.node(NodeKind::Predicate(PredKind::Test), props))
            }
        }
    }

    fn nullish(&mut self, obj: &Map) -> BuildResult<Arc<Node>> {
        let mut props = Props::new();
        props.insert("input".into(), self.transform(&obj.get("input").cloned().unwrap_or_default())?);
        props.insert("fallback".into(), self.transform(&obj.get("fallback").cloned().unwrap_or_default())?);
        Ok(self.node(NodeKind::Expr(ExprKind::Nullish), props))
    }

    fn test_predicate(&mut self, obj: &Map) -> BuildResult<Arc<Node>> {
        let subject = obj.get("subject").cloned().unwrap_or_default();
        if subject.is_undefined() {
            return Err(invalid("Test predicate requires a subject"));
        }
        let condition = Self::get(obj, "condition").filter(|c| c.truthy()).ok_or_else(|| invalid("Test predicate requires a condition"))?;
        let mut props = Props::new();
        props.insert("subject".into(), self.transform(&subject)?);
        props.insert("condition".into(), Prop::Node(self.create_node(condition)?));
        props.insert("negate".into(), Prop::Lit(Self::get(obj, "negate").filter(|v| !v.is_nullish()).cloned().unwrap_or(Value::Bool(false))));
        Ok(self.node(NodeKind::Predicate(PredKind::Test), props))
    }

    fn not_predicate(&mut self, obj: &Map) -> BuildResult<Arc<Node>> {
        let operand = Self::get(obj, "operand").filter(|o| o.truthy()).ok_or_else(|| invalid("Not predicate requires an operand"))?;
        let mut props = Props::new();
        props.insert("operand".into(), Prop::Node(self.create_node(operand)?));
        Ok(self.node(NodeKind::Predicate(PredKind::Not), props))
    }

    fn nary_predicate(&mut self, obj: &Map, kind: PredKind) -> BuildResult<Arc<Node>> {
        let operands = match obj.get("operands") {
            Some(Value::Array(ops)) if !ops.is_empty() => ops.clone(),
            _ => return Err(invalid("Logical predicate requires at least one operand")),
        };
        let mut out = Vec::new();
        for op in operands.iter() {
            out.push(Prop::Node(self.create_node(op)?));
        }
        let mut props = Props::new();
        props.insert("operands".into(), Prop::Array(out));
        Ok(self.node(NodeKind::Predicate(kind), props))
    }

    fn node_list(&mut self, v: &Value) -> BuildResult<Option<Prop>> {
        let Value::Array(items) = v else { return Ok(None) };
        let mut out = Vec::new();
        for item in items.iter() {
            out.push(Prop::Node(self.create_node(item)?));
        }
        Ok(Some(Prop::Array(out)))
    }

    fn access_hook(&mut self, obj: &Map) -> BuildResult<Arc<Node>> {
        let mut props = Props::new();
        if let Some(when) = obj.get("when").filter(|w| w.truthy()) {
            props.insert("when".into(), Prop::Node(self.create_node(when)?));
        }
        for key in ["effects", "next"] {
            if let Some(list) = self.node_list(&obj.get(key).cloned().unwrap_or_default())? {
                props.insert(key.into(), list);
            }
        }
        Ok(self.node(NodeKind::Hook(HookKind::Access), props))
    }

    fn submit_hook(&mut self, obj: &Map) -> BuildResult<Arc<Node>> {
        let validate = obj.get("validate").cloned().unwrap_or_default();
        let mut props = Props::new();
        props.insert(
            "validate".into(),
            Prop::Lit(Value::Bool(!validate.is_undefined() && !matches!(validate, Value::Bool(false)))),
        );
        let groups = match &validate {
            Value::Bool(true) => Prop::Array(vec![Prop::Lit(Value::string("default"))]),
            Value::Bool(false) | Value::Undefined => Prop::Array(vec![]),
            other => static_prop(&other.get("groups")),
        };
        props.insert("validationGroups".into(), groups);
        for key in ["when", "guards"] {
            if let Some(v) = obj.get(key).filter(|w| w.truthy()) {
                props.insert(key.into(), Prop::Node(self.create_node(v)?));
            }
        }
        for key in ["onAlways", "onValid", "onInvalid"] {
            if let Some(branch) = obj.get(key).filter(|w| w.truthy()) {
                let mut bp = Props::new();
                for inner in ["effects", "next"] {
                    if let Some(list) = self.node_list(&branch.get(inner))? {
                        bp.insert(inner.into(), list);
                    }
                }
                props.insert(key.into(), Prop::Object(bp));
            }
        }
        Ok(self.node(NodeKind::Hook(HookKind::Submit), props))
    }

    fn redirect(&mut self, obj: &Map) -> BuildResult<Arc<Node>> {
        let mut props = Props::new();
        props.insert("goto".into(), self.transform(&obj.get("goto").cloned().unwrap_or_default())?);
        if let Some(when) = obj.get("when").filter(|w| w.truthy()) {
            props.insert("when".into(), Prop::Node(self.create_node(when)?));
        }
        Ok(self.node(NodeKind::Outcome(OutcomeKind::Redirect), props))
    }

    fn throw_error(&mut self, obj: &Map) -> BuildResult<Arc<Node>> {
        let mut props = Props::new();
        props.insert("status".into(), Prop::Lit(obj.get("status").cloned().unwrap_or_default()));
        let message = obj.get("message").cloned().unwrap_or_default();
        let message = if message.as_str().is_some() { Prop::Lit(message) } else { self.transform(&message)? };
        props.insert("message".into(), message);
        if let Some(when) = obj.get("when").filter(|w| w.truthy()) {
            props.insert("when".into(), Prop::Node(self.create_node(when)?));
        }
        Ok(self.node(NodeKind::Outcome(OutcomeKind::ThrowError), props))
    }

    /// `compileTemplate`: copies built nodes into template nodes with pre-order `template:N` IDs.
    pub fn compile_template(&mut self, prop: &Prop) -> Prop {
        match prop {
            Prop::Lit(v) => Prop::Lit(v.clone()),
            Prop::Array(items) => Prop::Array(items.iter().map(|p| self.compile_template(p)).collect()),
            Prop::Object(o) => Prop::Object(o.iter().map(|(k, v)| (k.clone(), self.compile_template(v))).collect()),
            // An existing template (a nested iterator's body, compiled when that iterator was
            // built) is copied as a plain object in TS, so it keeps its IDs.
            Prop::Node(node) if node.template => Prop::Node(node.clone()),
            Prop::Node(node) => {
                let id = self.ids.next_template();
                let props = node.props.iter().map(|(k, v)| (k.clone(), self.compile_template(v))).collect();
                Prop::Node(Arc::new(Node {
                    id,
                    template: true,
                    kind: node.kind.clone(),
                    props,
                    source_path: node.source_path.clone(),
                }))
            }
        }
    }
}

/// A prop holding plain data that is never transformed into nodes (`data`, `metadata`, groups).
pub fn static_prop(v: &Value) -> Prop {
    match v {
        Value::Array(items) => Prop::Array(items.iter().map(static_prop).collect()),
        Value::Object(o) => Prop::Object(o.iter().map(|(k, v)| (k.clone(), static_prop(v))).collect()),
        other => Prop::Lit(other.clone()),
    }
}

/// Registered AST: every non-template node by ID, with parent links (`ASTNodeIndex`).
#[derive(Default)]
pub struct AstIndex {
    pub nodes: HashMap<NodeId, Arc<Node>>,
    pub parents: HashMap<NodeId, NodeId>,
    /// Registration order (pre-order walk), for deterministic iteration.
    pub order: Vec<NodeId>,
}

impl AstIndex {
    /// Walks the tree from `root`, registering nodes and wiring parents (`NodeRegistrationWalker`).
    /// Template nodes are not registered.
    pub fn build(root: &Arc<Node>) -> Self {
        let mut index = AstIndex::default();
        index.register(root, None);
        index
    }

    fn register(&mut self, node: &Arc<Node>, parent: Option<&NodeId>) {
        if node.template {
            return;
        }
        self.nodes.insert(node.id.clone(), node.clone());
        self.order.push(node.id.clone());
        if let Some(p) = parent {
            self.parents.insert(node.id.clone(), p.clone());
        }
        for prop in node.props.values() {
            let mut children = Vec::new();
            prop.for_each_node(&mut |n| children.push(n.clone()));
            for child in children {
                self.register(&child, Some(&node.id));
            }
        }
    }

    pub fn get(&self, id: &str) -> Option<&Arc<Node>> {
        self.nodes.get(id)
    }

    pub fn parent(&self, id: &str) -> Option<&Arc<Node>> {
        self.parents.get(id).and_then(|p| self.nodes.get(p))
    }

    /// Ancestors from nearest to root.
    pub fn ancestors(&self, id: &str) -> Vec<Arc<Node>> {
        let mut out = Vec::new();
        let mut current = self.parents.get(id);
        while let Some(p) = current {
            if let Some(node) = self.nodes.get(p) {
                out.push(node.clone());
            }
            current = self.parents.get(p);
        }
        out
    }

    /// Ancestor journeys from nearest to root.
    pub fn ancestor_journeys(&self, id: &str) -> Vec<Arc<Node>> {
        self.ancestors(id).into_iter().filter(|n| n.kind == NodeKind::Journey).collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::val;

    #[test]
    fn ids_are_post_order_like_typescript() {
        // The contract scaffold's "field validation" journey yields block compile_ast:11,
        // steps 12-14, journey 15 in the TS engine.
        let journey = val!({
            "code": "scaffold", "path": "/scaffold", "title": "Step scaffold",
            "onAccess": [{ "effects": [
                { "type": "FunctionType.Effect", "name": "LoadAnswers", "arguments": ["scaffold"] },
                { "type": "FunctionType.Effect", "name": "LoadData", "arguments": [] }
            ], "type": "HookType.Access" }],
            "steps": [
                { "path": "/step", "title": "Step", "reachability": { "entryWhen": true },
                  "blocks": [{ "code": "fullName", "validWhen": [{
                      "condition": { "type": "PredicateType.Test",
                          "subject": { "type": "ExpressionType.Reference", "path": ["answers", "@self"] },
                          "negate": false,
                          "condition": { "type": "FunctionType.Condition", "name": "IsRequired", "arguments": [] } },
                      "message": "Enter your full name", "type": "ExpressionType.Validation" }],
                    "variant": "testTextField", "type": "StructureType.Block", "blockType": "BlockType.field" }],
                  "onSubmission": [{ "validate": true, "onValid": {
                      "effects": [{ "type": "FunctionType.Effect", "name": "SaveAnswers", "arguments": ["scaffold"] }],
                      "next": [{ "goto": "done", "type": "Outcome.Redirect" }] }, "type": "HookType.Submit" }],
                  "type": "StructureType.Step" },
                { "code": "done", "path": "/done", "title": "Done", "blocks": [], "type": "StructureType.Step" },
                { "code": "invalid", "path": "/invalid", "title": "Invalid", "blocks": [], "type": "StructureType.Step" }
            ],
            "type": "StructureType.Journey"
        });
        let mut factory = NodeFactory::new();
        let root = factory.create_node(&journey).unwrap();
        assert_eq!(&*root.id, "compile_ast:15");
        let steps = root.children("steps");
        assert_eq!(steps.iter().map(|s| s.id.to_string()).collect::<Vec<_>>(), [
            "compile_ast:12",
            "compile_ast:13",
            "compile_ast:14"
        ]);
        assert_eq!(&*steps[0].children("blocks")[0].id, "compile_ast:11");
        let index = AstIndex::build(&root);
        assert_eq!(index.parent("compile_ast:11").map(|n| n.id.to_string()).as_deref(), Some("compile_ast:12"));
    }
}
