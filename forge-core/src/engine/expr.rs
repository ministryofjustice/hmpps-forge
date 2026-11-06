//! Compiled expressions: the Rust counterpart of the TS lowering layer's `ExpressionDispatcher`
//! and its node compilers (reference, predicate, pipeline, conditional, match, nullish, iterate).
//!
//! TS lowering emits JavaScript; here lowering builds an [`Expr`] tree with every registered
//! function resolved and every reference path pre-split, and an async evaluator runs it. Each
//! evaluation rule below is a transliteration of the source the TS compilers emit, so JS
//! semantics carry over: `&&`/`||`-style predicate folding that returns operand values,
//! `!(x)` producing booleans, iterator input normalisation, `?.` property chains.

use std::sync::Arc;

use futures::future::BoxFuture;
use futures::FutureExt;

use crate::engine::ast::{ExprKind, Node, NodeKind, PredKind, Prop};
use crate::engine::errors::{ForgeError, ForgeResult};
use crate::engine::registries::{FunctionEntry, FunctionRegistry};
use crate::engine::runtime::context::SharedContext;
use crate::value::{Map, OpaqueValue, Value};

/// One iterator scope frame (`IteratorScopeFrame`).
#[derive(Clone, Debug)]
pub struct Frame {
    /// The item scope object (`Object.assign({}, raw)` or `{ "@value": raw }`).
    pub item: Value,
    pub raw: Value,
    pub index: usize,
    pub len: usize,
}

/// What an expression can see while it runs.
#[derive(Clone)]
pub struct Scope {
    pub ctx: SharedContext,
    pub frames: Vec<Frame>,
    /// The field code `Self()` resolves to, when evaluating a field's own expressions.
    pub self_code: Option<Value>,
}

impl Scope {
    pub fn new(ctx: SharedContext) -> Self {
        Self { ctx, frames: Vec::new(), self_code: None }
    }

    pub fn with_self(&self, code: Value) -> Self {
        let mut s = self.clone();
        s.self_code = Some(code);
        s
    }

    fn frame(&self, level: usize) -> Option<&Frame> {
        self.frames.len().checked_sub(1 + level).and_then(|i| self.frames.get(i))
    }

    /// Iterator indexes outer to inner, for compiled template instance IDs.
    pub fn frame_indexes(&self) -> Vec<usize> {
        self.frames.iter().map(|f| f.index).collect()
    }
}

/// A reference path segment after the namespace.
#[derive(Clone, Debug)]
pub enum Seg {
    Key(Arc<str>),
    /// An expression segment. Only the answer code position evaluates it (`[String(expr)]`);
    /// elsewhere TS stringifies the AST node itself, which yields `[object Object]`.
    Dynamic(Box<Expr>),
}

#[derive(Clone, Copy, Debug)]
pub enum LoopProp {
    Index,
    Index0,
    RevIndex,
    RevIndex0,
    First,
    Last,
    Length,
}

#[derive(Clone, Debug)]
pub enum ScopeProp {
    /// `Item()` itself: the raw item.
    Raw,
    Key,
    Value,
    /// `Item().path(...)`: property then optional rest.
    Path(Arc<str>, Vec<Arc<str>>),
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CtxNs {
    Data,
    Session,
    Params,
    Query,
    Request,
    Post,
    /// Any other namespace reads `ctx[namespace]`, which compiled contexts never populate.
    Other,
}

#[derive(Clone, Debug)]
pub enum Reference {
    Undefined,
    /// `ctx.answers[code]?.current` then optional rest.
    Answer { code: Seg, rest: Vec<Seg> },
    /// `ctx.answers[selfCode]?.current`.
    SelfAnswer { rest: Vec<Seg> },
    Scope { level: usize, prop: ScopeProp },
    Loop { level: usize, prop: LoopProp },
    Ctx { ns: CtxNs, rest: Vec<Seg> },
    Base { base: Box<Expr>, rest: Vec<Seg> },
}

#[derive(Clone)]
pub struct Call {
    pub entry: Arc<FunctionEntry>,
    pub args: Vec<Expr>,
    pub node_id: Arc<str>,
}

impl std::fmt::Debug for Call {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "Call({}, {:?})", self.entry.name, self.args)
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum IterKind {
    Map,
    Filter,
    Find,
    Some,
    Every,
    Count,
}

/// A predicate compiled against an externally supplied subject (match branches).
#[derive(Clone, Debug)]
pub enum BranchPred {
    Test { call: Call, negate: bool },
    And(Vec<BranchPred>),
    Or(Vec<BranchPred>),
    Xor(Vec<BranchPred>),
    Not(Box<BranchPred>),
    /// An operand that is not a predicate: compiled normally, ignores the subject.
    Other(Box<Expr>),
}

#[derive(Clone, Debug)]
pub enum MatchArm {
    Expected(Expr),
    Pred(BranchPred),
}

#[derive(Clone, Debug)]
pub enum Expr {
    Lit(Value),
    Array(Vec<Expr>),
    Object(Vec<(Arc<str>, Expr)>),
    Ref(Reference),
    /// A condition/transformer/generator call; for conditions `args[0]` is the subject.
    Call(Call),
    Pipeline { input: Box<Expr>, steps: Vec<Call> },
    Test { call: Call, negate: bool },
    And(Vec<Expr>),
    Or(Vec<Expr>),
    Xor(Vec<Expr>),
    Not(Box<Expr>),
    Nullish { input: Box<Expr>, fallback: Box<Expr> },
    Conditional { predicate: Box<Expr>, then: Box<Expr>, otherwise: Box<Expr> },
    Match { subject: Box<Expr>, arms: Vec<(MatchArm, Expr)>, otherwise: Option<Box<Expr>> },
    Iterate { input: Box<Expr>, kind: Option<IterKind>, body: Option<Box<Expr>> },
    /// A validation rule: evaluates to a [`RuleValue`] closing over the current scope.
    Validation(Arc<ValidationRule>),
    /// A block in expression position: evaluates to a [`BlockInstance`].
    Block(Arc<Node>),
}

/// A compiled validation rule (`compileValidation`).
#[derive(Debug)]
pub struct ValidationRule {
    pub condition: Expr,
    pub message: Expr,
    pub submission_only: bool,
    pub groups: Option<Expr>,
    pub details: Option<Expr>,
    pub node_id: Arc<str>,
}

/// A validation rule value: the rule plus the scope it was created in. Like the TS rule
/// object, its `groups` are evaluated when the rule is created; condition, message and details
/// are evaluated later, in the captured scope.
pub struct RuleValue {
    pub rule: Arc<ValidationRule>,
    pub frames: Vec<Frame>,
    pub self_code: Option<Value>,
    pub groups: Value,
}

impl OpaqueValue for RuleValue {
    /// The JSON view of the TS rule object `{ condition, message, submissionOnly, groups, details }`:
    /// functions drop out, so only static message/details survive.
    fn view(&self) -> Value {
        let static_or_undefined = |e: &Expr| match e {
            Expr::Lit(v) => v.clone(),
            _ => Value::Undefined,
        };
        Value::from_pairs([
            ("message", static_or_undefined(&self.rule.message)),
            ("submissionOnly", Value::Bool(self.rule.submission_only)),
            ("groups", self.groups.clone()),
            ("details", self.rule.details.as_ref().map(static_or_undefined).unwrap_or_default()),
        ])
    }

    fn as_any(&self) -> &dyn std::any::Any {
        self
    }
}

/// A block reached during expression evaluation, with the iterator scope it appeared in.
pub struct BlockInstance {
    pub node: Arc<Node>,
    pub frames: Vec<Frame>,
}

impl BlockInstance {
    /// `compiled:<template id>:<indexes>` for template blocks, the node ID otherwise.
    pub fn instance_id(&self) -> String {
        instance_id(&self.node, &self.frames.iter().map(|f| f.index).collect::<Vec<_>>())
    }
}

pub fn instance_id(node: &Node, indexes: &[usize]) -> String {
    if !node.template {
        return node.id.to_string();
    }
    let prefix = format!("compiled:{}", node.id);
    if indexes.is_empty() {
        prefix
    } else {
        format!("{prefix}:{}", indexes.iter().map(usize::to_string).collect::<Vec<_>>().join(":"))
    }
}

impl OpaqueValue for BlockInstance {
    fn view(&self) -> Value {
        Value::from_pairs([("id", Value::from(self.instance_id())), ("variant", Value::String(self.node.variant().cloned().unwrap_or_default()))])
    }

    fn as_any(&self) -> &dyn std::any::Any {
        self
    }
}

/// Lowers AST props into [`Expr`]s, resolving registered functions.
pub struct ExprCompiler<'a> {
    pub functions: &'a FunctionRegistry,
}

impl<'a> ExprCompiler<'a> {
    pub fn new(functions: &'a FunctionRegistry) -> Self {
        Self { functions }
    }

    /// `compileOperandCode`.
    pub fn operand(&self, prop: &Prop) -> ForgeResult<Expr> {
        Ok(match prop {
            Prop::Lit(v) => Expr::Lit(v.clone()),
            Prop::Array(items) => Expr::Array(items.iter().map(|p| self.operand(p)).collect::<ForgeResult<_>>()?),
            Prop::Object(o) => {
                Expr::Object(o.iter().map(|(k, v)| Ok((k.clone(), self.operand(v)?))).collect::<ForgeResult<_>>()?)
            }
            Prop::Node(n) => self.node(n)?,
        })
    }

    pub fn operand_opt(&self, prop: Option<&Prop>) -> ForgeResult<Expr> {
        prop.map_or(Ok(Expr::Lit(Value::Undefined)), |p| self.operand(p))
    }

    /// `compileExpressionCode` for one node.
    pub fn node(&self, node: &Arc<Node>) -> ForgeResult<Expr> {
        match &node.kind {
            NodeKind::Predicate(kind) => self.predicate(*kind, node),
            NodeKind::Expr(kind) => self.expression(*kind, node),
            NodeKind::Block { .. } => Ok(Expr::Block(node.clone())),
            _ => Ok(Expr::Lit(Value::Undefined)),
        }
    }

    fn expression(&self, kind: ExprKind, node: &Arc<Node>) -> ForgeResult<Expr> {
        match kind {
            ExprKind::Reference => Ok(Expr::Ref(self.reference(node)?)),
            ExprKind::Pipeline => {
                let input = self.operand_opt(node.prop("input"))?;
                let steps = node
                    .children("steps")
                    .iter()
                    .map(|s| self.call(s, Some(Expr::Lit(Value::Undefined))))
                    .collect::<ForgeResult<_>>()?;
                Ok(Expr::Pipeline { input: Box::new(input), steps })
            }
            ExprKind::Iterate => self.iterate(node),
            ExprKind::Validation => Ok(Expr::Validation(Arc::new(self.validation(node)?))),
            ExprKind::Condition | ExprKind::Transformer | ExprKind::Generator => Ok(Expr::Call(self.call(node, None)?)),
            ExprKind::Nullish => Ok(Expr::Nullish {
                input: Box::new(self.operand_opt(node.prop("input"))?),
                fallback: Box::new(self.operand_opt(node.prop("fallback"))?),
            }),
            ExprKind::Conditional => Ok(Expr::Conditional {
                predicate: Box::new(self.operand_opt(node.prop("predicate"))?),
                then: Box::new(self.operand_opt(node.prop("thenValue"))?),
                otherwise: Box::new(self.operand_opt(node.prop("elseValue"))?),
            }),
            ExprKind::Match => {
                let subject = self.operand_opt(node.prop("subject"))?;
                let mut arms = Vec::new();
                for branch in node.prop("branches").and_then(Prop::as_array).unwrap_or_default() {
                    let Some(b) = branch.as_object() else { continue };
                    let arm = if let Some(expected) = b.get("expected") {
                        MatchArm::Expected(self.operand(expected)?)
                    } else {
                        MatchArm::Pred(self.branch_pred(b.get("predicate"))?)
                    };
                    arms.push((arm, self.operand_opt(b.get("value"))?));
                }
                let otherwise = match node.prop("otherwise") {
                    Some(o) => Some(Box::new(self.operand(o)?)),
                    None => None,
                };
                Ok(Expr::Match { subject: Box::new(subject), arms, otherwise })
            }
            _ => Ok(Expr::Lit(Value::Undefined)),
        }
    }

    /// Resolves a function node into a call. `subject` is prepended to the arguments.
    pub fn call(&self, node: &Arc<Node>, subject: Option<Expr>) -> ForgeResult<Call> {
        let name = node.str_prop("name").unwrap_or_default();
        let entry = self.functions.get(name).ok_or_else(|| ForgeError::UnregisteredFunction {
            name: name.to_string(),
            function_type: node.expr_kind().map(|k| k.tag()).unwrap_or("unknown").to_string(),
        })?;
        let mut args = Vec::new();
        args.extend(subject);
        for arg in node.prop("arguments").and_then(Prop::as_array).unwrap_or_default() {
            args.push(self.operand(arg)?);
        }
        Ok(Call { entry: Arc::new(entry.clone()), args, node_id: node.id.clone() })
    }

    fn predicate(&self, kind: PredKind, node: &Arc<Node>) -> ForgeResult<Expr> {
        let operands = || -> ForgeResult<Vec<Expr>> {
            node.prop("operands")
                .and_then(Prop::as_array)
                .unwrap_or_default()
                .iter()
                .map(|p| self.operand(p))
                .collect()
        };
        Ok(match kind {
            PredKind::Test => {
                let (Some(subject), Some(condition)) = (node.prop("subject"), node.node_prop("condition")) else {
                    return Ok(Expr::Lit(Value::Bool(false)));
                };
                let call = self.call(condition, Some(self.operand(subject)?))?;
                let negate = node.prop("negate").and_then(Prop::as_lit).is_some_and(|v| v.strict_eq(&Value::Bool(true)));
                Expr::Test { call, negate }
            }
            PredKind::And => {
                let ops = operands()?;
                if ops.is_empty() { Expr::Lit(Value::Bool(true)) } else { Expr::And(ops) }
            }
            PredKind::Or => {
                let ops = operands()?;
                if ops.is_empty() { Expr::Lit(Value::Bool(false)) } else { Expr::Or(ops) }
            }
            PredKind::Xor => Expr::Xor(operands()?),
            PredKind::Not => Expr::Not(Box::new(self.operand_opt(node.prop("operand"))?)),
        })
    }

    /// `PredicateNodeCompiler.compileOperand(operand, matchSubject)`.
    pub fn branch_pred(&self, prop: Option<&Prop>) -> ForgeResult<BranchPred> {
        let Some(Prop::Node(node)) = prop else {
            return Ok(BranchPred::Other(Box::new(self.operand_opt(prop)?)));
        };
        let NodeKind::Predicate(kind) = node.kind else {
            return Ok(BranchPred::Other(Box::new(self.node(node)?)));
        };
        let ops = || -> ForgeResult<Vec<BranchPred>> {
            node.prop("operands")
                .and_then(Prop::as_array)
                .unwrap_or_default()
                .iter()
                .map(|p| self.branch_pred(Some(p)))
                .collect()
        };
        Ok(match kind {
            PredKind::Test => match node.node_prop("condition") {
                Some(condition) => BranchPred::Test {
                    call: self.call(condition, Some(Expr::Lit(Value::Undefined)))?,
                    negate: node.prop("negate").and_then(Prop::as_lit).is_some_and(|v| v.strict_eq(&Value::Bool(true))),
                },
                None => BranchPred::Other(Box::new(Expr::Lit(Value::Bool(false)))),
            },
            PredKind::And => {
                let o = ops()?;
                if o.is_empty() { BranchPred::Other(Box::new(Expr::Lit(Value::Bool(true)))) } else { BranchPred::And(o) }
            }
            PredKind::Or => {
                let o = ops()?;
                if o.is_empty() { BranchPred::Other(Box::new(Expr::Lit(Value::Bool(false)))) } else { BranchPred::Or(o) }
            }
            PredKind::Xor => BranchPred::Xor(ops()?),
            PredKind::Not => BranchPred::Not(Box::new(self.branch_pred(node.prop("operand"))?)),
        })
    }

    fn iterate(&self, node: &Arc<Node>) -> ForgeResult<Expr> {
        let input = self.operand_opt(node.prop("input"))?;
        let iterator = node.prop("iterator").and_then(Prop::as_object);
        let kind = iterator.and_then(|i| i.get("type")).and_then(Prop::as_str).and_then(iter_kind);
        let body = match kind {
            Some(IterKind::Map) => iterator.and_then(|i| i.get("yieldTemplate")),
            Some(_) => iterator.and_then(|i| i.get("predicateTemplate")),
            None => None,
        };
        let body = match body {
            Some(b) => Some(Box::new(self.operand(b)?)),
            None => None,
        };
        Ok(Expr::Iterate { input: Box::new(input), kind, body })
    }

    fn validation(&self, node: &Arc<Node>) -> ForgeResult<ValidationRule> {
        Ok(ValidationRule {
            condition: self.operand_opt(node.prop("condition"))?,
            message: match node.prop("message") {
                Some(m) => self.operand(m)?,
                None => Expr::Lit(Value::string("")),
            },
            submission_only: node.prop("submissionOnly").and_then(Prop::as_lit).is_some_and(|v| v.strict_eq(&Value::Bool(true))),
            groups: match node.prop("groups") {
                Some(g) => Some(self.operand(g)?),
                None => None,
            },
            details: match node.prop("details") {
                Some(d) => Some(self.operand(d)?),
                None => None,
            },
            node_id: node.id.clone(),
        })
    }

    fn seg(&self, prop: &Prop) -> ForgeResult<Seg> {
        Ok(match prop {
            Prop::Lit(v) => Seg::Key(v.to_js_string().into()),
            other => Seg::Dynamic(Box::new(self.operand(other)?)),
        })
    }

    fn segs(&self, props: &[Prop]) -> ForgeResult<Vec<Seg>> {
        props.iter().map(|p| self.seg(p)).collect()
    }

    /// `ReferenceNodeCompiler.compile`.
    fn reference(&self, node: &Arc<Node>) -> ForgeResult<Reference> {
        let path = node.prop("path").and_then(Prop::as_array).unwrap_or_default();
        let base = node.prop("base").filter(|b| !b.is_undefined());
        if path.is_empty() {
            return Ok(match base {
                Some(b) => Reference::Base { base: Box::new(self.operand(b)?), rest: Vec::new() },
                None => Reference::Undefined,
            });
        }
        if let Some(b) = base {
            return Ok(Reference::Base { base: Box::new(self.operand(b)?), rest: self.segs(path)? });
        }
        let namespace = path[0].as_lit().map(Value::to_js_string).unwrap_or_default();
        let level = |p: Option<&Prop>| -> usize {
            match p.and_then(Prop::as_lit) {
                Some(Value::Number(n)) => *n as usize,
                Some(Value::String(s)) => parse_int_prefix(s),
                _ => 0,
            }
        };
        match namespace.as_str() {
            "@scope" => {
                if path.len() < 2 {
                    return Ok(Reference::Undefined);
                }
                let lvl = level(path.get(1));
                let prop = match path.get(2) {
                    None => ScopeProp::Raw,
                    Some(p) => {
                        let key = p.as_lit().map(Value::to_js_string).unwrap_or_default();
                        match key.as_str() {
                            "@key" => ScopeProp::Key,
                            "@item" => ScopeProp::Raw,
                            "@value" => ScopeProp::Value,
                            _ => ScopeProp::Path(
                                key.into(),
                                path[3..].iter().map(|p| p.as_lit().map(Value::to_js_string).unwrap_or_else(|| "[object Object]".into()).into()).collect(),
                            ),
                        }
                    }
                };
                Ok(Reference::Scope { level: lvl, prop })
            }
            "@loop" => {
                if path.len() < 3 {
                    return Ok(Reference::Undefined);
                }
                let prop = match path[2].as_lit().map(Value::to_js_string).as_deref() {
                    Some("index") => LoopProp::Index,
                    Some("index0") => LoopProp::Index0,
                    Some("revindex") => LoopProp::RevIndex,
                    Some("revindex0") => LoopProp::RevIndex0,
                    Some("first") => LoopProp::First,
                    Some("last") => LoopProp::Last,
                    Some("length") => LoopProp::Length,
                    _ => return Ok(Reference::Undefined),
                };
                Ok(Reference::Loop { level: level(path.get(1)), prop })
            }
            "@self" => Ok(Reference::SelfAnswer { rest: self.segs(&path[1..])? }),
            "answers" => {
                if path.len() < 2 {
                    return Ok(Reference::Undefined);
                }
                if path[1].as_lit().is_some_and(|v| v.as_str() == Some("@self")) {
                    return Ok(Reference::SelfAnswer { rest: self.segs(&path[2..])? });
                }
                Ok(Reference::Answer { code: self.seg(&path[1])?, rest: self.segs(&path[2..])? })
            }
            ns => {
                let ns = match ns {
                    "data" => CtxNs::Data,
                    "session" => CtxNs::Session,
                    "params" => CtxNs::Params,
                    "query" => CtxNs::Query,
                    "request" => CtxNs::Request,
                    "post" => CtxNs::Post,
                    _ => CtxNs::Other,
                };
                Ok(Reference::Ctx { ns, rest: self.segs(&path[1..])? })
            }
        }
    }
}

fn parse_int_prefix(s: &str) -> usize {
    s.trim().chars().take_while(char::is_ascii_digit).collect::<String>().parse().unwrap_or(0)
}

pub fn iter_kind(tag: &str) -> Option<IterKind> {
    Some(match tag {
        "IteratorType.Map" => IterKind::Map,
        "IteratorType.Filter" => IterKind::Filter,
        "IteratorType.Find" => IterKind::Find,
        "IteratorType.Some" => IterKind::Some,
        "IteratorType.Every" => IterKind::Every,
        "IteratorType.Count" => IterKind::Count,
        _ => return None,
    })
}

/// Iterator input normalisation (`compileNormalizeIteratorInput`): objects become keyed entry
/// arrays, nullish array items are dropped, anything else is not iterable.
pub fn normalize_iterator_input(input: Value) -> Option<Vec<Value>> {
    let items: Vec<Value> = match input {
        Value::Object(o) => o
            .iter()
            .map(|(k, v)| {
                if v.is_object_like() {
                    let mut m = Map::new();
                    m.insert("@key".into(), Value::String(k.clone()));
                    assign_into(&mut m, v);
                    Value::object(m)
                } else {
                    Value::from_pairs([("@key", Value::String(k.clone())), ("@value", v.clone())])
                }
            })
            .collect(),
        Value::Array(a) => a.iter().cloned().collect(),
        _ => return None,
    };
    Some(items.into_iter().filter(|i| !i.is_nullish()).collect())
}

/// `Object.assign(target, source)` for a plain-data source.
fn assign_into(target: &mut Map, source: &Value) {
    match source {
        Value::Object(o) => o.iter().for_each(|(k, v)| {
            target.insert(k.clone(), v.clone());
        }),
        Value::Array(a) => a.iter().enumerate().for_each(|(i, v)| {
            target.insert(i.to_string().into(), v.clone());
        }),
        Value::Opaque(o) => assign_into(target, &o.view()),
        _ => {}
    }
}

/// The per-item scope object (`compileIteratorItemScopeExpression`).
pub fn item_scope(raw: &Value) -> Value {
    if raw.is_object_like() {
        let mut m = Map::new();
        assign_into(&mut m, raw);
        Value::object(m)
    } else {
        Value::from_pairs([("@value", raw.clone())])
    }
}

/// Cursor over iterator items that keeps the scope's frame stack in step
/// (`IteratorLoopEmitter.compileLoop`). Call [`ItemLoop::next`] until it returns `None`, or call
/// [`ItemLoop::finish`] after breaking out early.
pub struct ItemLoop {
    items: Vec<Value>,
    next: usize,
    active: bool,
}

impl ItemLoop {
    pub fn new(input: Value) -> Self {
        Self { items: normalize_iterator_input(input).unwrap_or_default(), next: 0, active: false }
    }

    /// Pops the previous item's frame and pushes the next one. Returns the raw item.
    pub fn next(&mut self, scope: &mut Scope) -> ForgeResult<Option<Value>> {
        self.finish(scope);
        let Some(raw) = self.items.get(self.next).cloned() else { return Ok(None) };
        scope.ctx.lock().consume_iteration()?;
        scope.frames.push(Frame { item: item_scope(&raw), raw: raw.clone(), index: self.next, len: self.items.len() });
        self.active = true;
        self.next += 1;
        Ok(Some(raw))
    }

    pub fn finish(&mut self, scope: &mut Scope) {
        if self.active {
            scope.frames.pop();
            self.active = false;
        }
    }
}

fn walk(mut value: Value, rest: &[Seg]) -> Value {
    for seg in rest {
        if value.is_nullish() {
            return Value::Undefined;
        }
        value = match seg {
            Seg::Key(k) => value.get(k),
            Seg::Dynamic(_) => value.get("[object Object]"),
        };
    }
    value
}

impl Expr {
    pub fn lit(v: impl Into<Value>) -> Self {
        Expr::Lit(v.into())
    }

    /// True when evaluation cannot throw (a reference with no function calls in it).
    pub fn is_static(&self) -> bool {
        matches!(self, Expr::Lit(_))
    }

    pub fn eval<'a>(&'a self, scope: &'a mut Scope) -> BoxFuture<'a, ForgeResult<Value>> {
        async move {
            match self {
                Expr::Lit(v) => Ok(v.clone()),
                Expr::Array(items) => {
                    let mut out = Vec::with_capacity(items.len());
                    for item in items {
                        out.push(item.eval(scope).await?);
                    }
                    Ok(Value::array(out))
                }
                Expr::Object(entries) => {
                    let mut map = Map::new();
                    for (k, v) in entries {
                        map.insert(k.clone(), v.eval(scope).await?);
                    }
                    Ok(Value::object(map))
                }
                Expr::Ref(r) => r.eval(scope).await,
                Expr::Call(call) => call.eval(scope, None).await,
                Expr::Pipeline { input, steps } => {
                    let mut value = input.eval(scope).await?;
                    for step in steps {
                        if value.is_undefined() {
                            continue;
                        }
                        value = step.eval(scope, Some(value)).await?;
                    }
                    Ok(value)
                }
                Expr::Test { call, negate } => {
                    let result = call.eval(scope, None).await?;
                    Ok(if *negate { Value::Bool(!result.truthy()) } else { result })
                }
                Expr::And(ops) => {
                    let mut result = ops[0].eval(scope).await?;
                    for op in &ops[1..] {
                        if result.truthy() {
                            result = op.eval(scope).await?;
                        }
                    }
                    Ok(result)
                }
                Expr::Or(ops) => {
                    let mut result = ops[0].eval(scope).await?;
                    for op in &ops[1..] {
                        if !result.truthy() {
                            result = op.eval(scope).await?;
                        }
                    }
                    Ok(result)
                }
                Expr::Xor(ops) => {
                    let mut count = 0;
                    for op in ops {
                        if op.eval(scope).await?.truthy() {
                            count += 1;
                        }
                    }
                    Ok(Value::Bool(count == 1))
                }
                Expr::Not(op) => Ok(Value::Bool(!op.eval(scope).await?.truthy())),
                Expr::Nullish { input, fallback } => {
                    let v = input.eval(scope).await?;
                    if v.is_nullish() { fallback.eval(scope).await } else { Ok(v) }
                }
                Expr::Conditional { predicate, then, otherwise } => {
                    if predicate.eval(scope).await?.truthy() {
                        then.eval(scope).await
                    } else {
                        otherwise.eval(scope).await
                    }
                }
                Expr::Match { subject, arms, otherwise } => {
                    let subject = subject.eval(scope).await?;
                    for (arm, value) in arms {
                        let matched = match arm {
                            MatchArm::Expected(e) => subject.strict_eq(&e.eval(scope).await?),
                            MatchArm::Pred(p) => p.eval(scope, &subject).await?.truthy(),
                        };
                        if matched {
                            return value.eval(scope).await;
                        }
                    }
                    match otherwise {
                        Some(o) => o.eval(scope).await,
                        None => Ok(Value::Undefined),
                    }
                }
                Expr::Iterate { input, kind, body } => {
                    let input = input.eval(scope).await?;
                    eval_iterate(scope, input, *kind, body.as_deref()).await
                }
                Expr::Validation(rule) => {
                    let groups = match &rule.groups {
                        Some(g) => g.eval(scope).await?,
                        None => Value::Undefined,
                    };
                    Ok(Value::opaque(RuleValue {
                        rule: rule.clone(),
                        frames: scope.frames.clone(),
                        self_code: scope.self_code.clone(),
                        groups,
                    }))
                }
                Expr::Block(node) => Ok(Value::opaque(BlockInstance { node: node.clone(), frames: scope.frames.clone() })),
            }
        }
        .boxed()
    }
}

async fn eval_iterate(scope: &mut Scope, input: Value, kind: Option<IterKind>, body: Option<&Expr>) -> ForgeResult<Value> {
    let Some(kind) = kind else { return Ok(Value::Undefined) };
    let mut out: Vec<Value> = Vec::new();
    let mut found = Value::Undefined;
    let mut flag = matches!(kind, IterKind::Every);
    let mut count = 0usize;
    let mut items = ItemLoop::new(input);
    while let Some(raw) = items.next(scope)? {
        let result = match body {
            Some(b) => b.eval(scope).await?,
            None if kind == IterKind::Map => Value::Undefined,
            None => Value::Bool(false),
        };
        let keep_going = match kind {
            IterKind::Map => {
                if !result.is_undefined() {
                    out.push(result);
                }
                true
            }
            IterKind::Filter => {
                if result.truthy() {
                    out.push(raw);
                }
                true
            }
            IterKind::Find => {
                let hit = result.truthy();
                if hit {
                    found = raw;
                }
                !hit
            }
            IterKind::Some => {
                let hit = result.truthy();
                if hit {
                    flag = true;
                }
                !hit
            }
            IterKind::Every => {
                let miss = !result.truthy();
                if miss {
                    flag = false;
                }
                !miss
            }
            IterKind::Count => {
                if result.truthy() {
                    count += 1;
                }
                true
            }
        };
        if !keep_going {
            break;
        }
    }
    items.finish(scope);
    Ok(match kind {
        IterKind::Map | IterKind::Filter => Value::array(out),
        IterKind::Find => found,
        IterKind::Some | IterKind::Every => Value::Bool(flag),
        IterKind::Count => Value::from(count),
    })
}

impl Call {
    /// Evaluates the call. `subject`, when given, replaces the first argument, which callers
    /// that supply a subject (pipelines, match branches) compile as a placeholder.
    pub async fn eval(&self, scope: &mut Scope, subject: Option<Value>) -> ForgeResult<Value> {
        let mut args = Vec::with_capacity(self.args.len());
        let mut iter = self.args.iter();
        if let Some(s) = subject {
            args.push(s);
            iter.next();
        }
        for arg in iter {
            args.push(arg.eval(scope).await?);
        }
        self.entry.call(args).await
    }
}

impl BranchPred {
    pub fn eval<'a>(&'a self, scope: &'a mut Scope, subject: &'a Value) -> BoxFuture<'a, ForgeResult<Value>> {
        async move {
            match self {
                BranchPred::Test { call, negate } => {
                    let result = call.eval(scope, Some(subject.clone())).await?;
                    Ok(if *negate { Value::Bool(!result.truthy()) } else { result })
                }
                BranchPred::And(ops) => {
                    let mut result = ops[0].eval(scope, subject).await?;
                    for op in &ops[1..] {
                        if result.truthy() {
                            result = op.eval(scope, subject).await?;
                        }
                    }
                    Ok(result)
                }
                BranchPred::Or(ops) => {
                    let mut result = ops[0].eval(scope, subject).await?;
                    for op in &ops[1..] {
                        if !result.truthy() {
                            result = op.eval(scope, subject).await?;
                        }
                    }
                    Ok(result)
                }
                BranchPred::Xor(ops) => {
                    let mut count = 0;
                    for op in ops {
                        if op.eval(scope, subject).await?.truthy() {
                            count += 1;
                        }
                    }
                    Ok(Value::Bool(count == 1))
                }
                BranchPred::Not(op) => Ok(Value::Bool(!op.eval(scope, subject).await?.truthy())),
                BranchPred::Other(e) => e.eval(scope).await,
            }
        }
        .boxed()
    }
}

impl Reference {
    async fn eval(&self, scope: &mut Scope) -> ForgeResult<Value> {
        Ok(match self {
            Reference::Undefined => Value::Undefined,
            Reference::Answer { code, rest } => {
                let code = match code {
                    Seg::Key(k) => k.to_string(),
                    Seg::Dynamic(e) => e.eval(scope).await?.to_js_string(),
                };
                let current = scope.ctx.lock().domain.answers.get(code.as_str()).map(|h| h.current.clone());
                walk(current.unwrap_or_default(), rest)
            }
            Reference::SelfAnswer { rest } => match &scope.self_code {
                Some(code) => {
                    let code = code.to_js_string();
                    let current = scope.ctx.lock().domain.answers.get(code.as_str()).map(|h| h.current.clone());
                    walk(current.unwrap_or_default(), rest)
                }
                None => Value::Undefined,
            },
            Reference::Scope { level, prop } => match scope.frame(*level) {
                None => Value::Undefined,
                Some(frame) => match prop {
                    ScopeProp::Raw => frame.raw.clone(),
                    ScopeProp::Key => frame.item.get("@key"),
                    ScopeProp::Value => frame.item.get("@value"),
                    ScopeProp::Path(first, rest) => {
                        let mut v = frame.item.get(first);
                        for k in rest {
                            if v.is_nullish() {
                                return Ok(Value::Undefined);
                            }
                            v = v.get(k);
                        }
                        v
                    }
                },
            },
            Reference::Loop { level, prop } => match scope.frame(*level) {
                None => Value::Undefined,
                Some(f) => match prop {
                    LoopProp::Index => Value::from(f.index + 1),
                    LoopProp::Index0 => Value::from(f.index),
                    LoopProp::RevIndex => Value::from(f.len - f.index),
                    LoopProp::RevIndex0 => Value::from(f.len - f.index - 1),
                    LoopProp::First => Value::Bool(f.index == 0),
                    LoopProp::Last => Value::Bool(f.index + 1 == f.len),
                    LoopProp::Length => Value::from(f.len),
                },
            },
            Reference::Ctx { ns, rest } => {
                let ctx = scope.ctx.lock();
                // Look up the first segment directly to avoid copying whole namespaces.
                let root = |first: Option<&Seg>| -> (Value, usize) {
                    let key = match first {
                        Some(Seg::Key(k)) => Some(k.as_ref()),
                        Some(Seg::Dynamic(_)) => Some("[object Object]"),
                        None => None,
                    };
                    match (ns, key) {
                        (CtxNs::Data, Some(k)) => (ctx.domain.data.get(k).cloned().unwrap_or_default(), 1),
                        (CtxNs::Data, None) => (Value::object(ctx.domain.data.clone()), 0),
                        (CtxNs::Session, _) => (ctx.request.session.clone(), 0),
                        (CtxNs::Params, _) => (ctx.request.params.clone(), 0),
                        (CtxNs::Query, _) => (ctx.request.query.clone(), 0),
                        (CtxNs::Post, _) => (ctx.request.post.clone(), 0),
                        (CtxNs::Request, _) => (ctx.request.to_value(), 0),
                        (CtxNs::Other, _) => (Value::Undefined, 0),
                    }
                };
                let (value, consumed) = root(rest.first());
                drop(ctx);
                walk(value, &rest[consumed..])
            }
            Reference::Base { base, rest } => {
                let v = base.eval(scope).await?;
                walk(v, rest)
            }
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::ast::NodeFactory;
    use crate::engine::runtime::context::{AnswerHistory, RuntimeContext};
    use crate::val;

    fn registry() -> FunctionRegistry {
        let mut r = FunctionRegistry::new();
        r.register(FunctionEntry::condition("Equals", |v, a| Ok(v.strict_eq(&a[0])))).unwrap();
        r.register(FunctionEntry::transformer("Upper", |v, _| Ok(Value::from(v.to_js_string().to_uppercase())))
            .with_input(crate::schema::Schema::String))
            .unwrap();
        r
    }

    async fn eval(json: Value, ctx: RuntimeContext) -> Value {
        let mut factory = NodeFactory::new();
        let prop = factory.transform(&json).unwrap();
        let reg = registry();
        let expr = ExprCompiler::new(&reg).operand(&prop).unwrap();
        expr.eval(&mut Scope::new(SharedContext::new(ctx))).await.unwrap()
    }

    #[tokio::test]
    async fn references_predicates_and_iterators() {
        let mut ctx = RuntimeContext::default();
        ctx.domain.answers.insert("name".into(), AnswerHistory { current: val!("ada"), ..Default::default() });
        ctx.domain.data.insert("items".into(), val!([{"n": 1}, null, {"n": 2}, {"n": 3}]));

        let pipeline = val!({"type": "ExpressionType.Pipeline",
            "input": {"type": "ExpressionType.Reference", "path": ["answers", "name"]},
            "steps": [{"type": "FunctionType.Transformer", "name": "Upper", "arguments": []}]});
        assert_eq!(eval(pipeline, RuntimeContext { domain: ctx.domain.clone(), ..Default::default() }).await, val!("ADA"));

        // Filter drops nulls first, so Loop.Index0 counts filtered items.
        let mapped = val!({"type": "ExpressionType.Iterate",
            "input": {"type": "ExpressionType.Reference", "path": ["data", "items"]},
            "iterator": {"type": "IteratorType.Map", "yield": {
                "n": {"type": "ExpressionType.Reference", "path": ["@scope", "0", "n"]},
                "i": {"type": "ExpressionType.Reference", "path": ["@loop", "0", "index0"]}}}});
        assert_eq!(
            eval(mapped, RuntimeContext { domain: ctx.domain.clone(), ..Default::default() }).await,
            val!([{"n": 1, "i": 0}, {"n": 2, "i": 1}, {"n": 3, "i": 2}])
        );

        // `and` returns the operand value, not a boolean.
        let and = val!({"type": "PredicateType.And", "operands": [
            {"type": "ExpressionType.Reference", "path": ["answers", "name"]},
            {"type": "ExpressionType.Reference", "path": ["answers", "name", "length"]}]});
        assert_eq!(eval(and, RuntimeContext { domain: ctx.domain.clone(), ..Default::default() }).await, val!(3));

        // Conditions short-circuit to false on an undefined subject.
        let test = val!({"type": "PredicateType.Test", "negate": true,
            "subject": {"type": "ExpressionType.Reference", "path": ["answers", "missing"]},
            "condition": {"type": "FunctionType.Condition", "name": "Equals", "arguments": [null]}});
        assert_eq!(eval(test, RuntimeContext::default()).await, val!(true));
    }
}
