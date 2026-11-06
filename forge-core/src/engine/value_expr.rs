//! Authored values: block properties, default values and similar trees that mix literals,
//! expressions, records, lists, conditionals, matches, iterations and nested blocks.
//!
//! Port of `AuthoredValueClassifier` (classification) and `RuntimeValueCompiler`
//! (materialisation). Unlike a plain [`Expr`], an authored value can recover from expression
//! errors with a fallback, drop `undefined` list items, and hand nested blocks to the resolve
//! concern - each concern picks its own [`ValuePolicy`].

use std::sync::Arc;

use futures::future::BoxFuture;
use futures::FutureExt;

use crate::engine::ast::{ExprKind, Node, NodeKind, Prop};
use crate::engine::errors::ForgeResult;
use crate::engine::expr::{iter_kind, ExprCompiler, Expr, IterKind, ItemLoop, MatchArm, Scope};
use crate::value::{Map, Value};

#[derive(Clone, Debug)]
pub enum ValueExpr {
    Static(Value),
    Expr(Expr),
    Record(Vec<(Arc<str>, ValueExpr)>),
    List(Vec<ValueExpr>),
    Conditional { predicate: Expr, then: Box<ValueExpr>, otherwise: Box<ValueExpr> },
    Match { subject: Box<ValueExpr>, arms: Vec<(MatchArm, ValueExpr)>, otherwise: Option<Box<ValueExpr>> },
    Map { input: Expr, yield_: Option<Box<ValueExpr>> },
    Filter { input: Expr, predicate: Option<Expr> },
    Find { input: Expr, predicate: Option<Expr> },
    /// A block (registered or template) with its classified properties.
    Block(Arc<BlockValue>),
}

#[derive(Debug)]
pub struct BlockValue {
    pub node: Arc<Node>,
    pub entries: Vec<(Arc<str>, ValueExpr)>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ErrorMode {
    /// Expression errors propagate.
    Throw,
    /// Expression errors yield the policy (or site) fallback.
    Fallback,
}

/// Turns a nested block into its runtime value (resolve's render blocks).
pub trait BlockHandler: Send + Sync {
    fn materialize<'a>(&'a self, block: &'a Arc<BlockValue>, scope: &'a mut Scope, policy: &'a ValuePolicy) -> BoxFuture<'a, ForgeResult<Value>>;
}

#[derive(Clone)]
pub struct ValuePolicy {
    pub mode: ErrorMode,
    pub fallback: Value,
    pub omit_undefined_array_items: bool,
    pub blocks: Option<Arc<dyn BlockHandler>>,
}

impl ValuePolicy {
    pub fn throwing() -> Self {
        Self { mode: ErrorMode::Throw, fallback: Value::Undefined, omit_undefined_array_items: false, blocks: None }
    }

    pub fn with_fallback(&self, fallback: Value) -> Self {
        Self { fallback, ..self.clone() }
    }
}

impl<'a> ExprCompiler<'a> {
    /// `AuthoredValueClassifier.classify` plus lowering of its expression leaves.
    pub fn value(&self, prop: &Prop) -> ForgeResult<ValueExpr> {
        if prop.is_static() {
            return Ok(ValueExpr::Static(prop.to_static_value()));
        }
        Ok(match prop {
            Prop::Lit(v) => ValueExpr::Static(v.clone()),
            Prop::Array(items) => ValueExpr::List(items.iter().map(|p| self.value(p)).collect::<ForgeResult<_>>()?),
            Prop::Object(o) => {
                ValueExpr::Record(o.iter().map(|(k, v)| Ok((k.clone(), self.value(v)?))).collect::<ForgeResult<_>>()?)
            }
            Prop::Node(node) => self.value_node(node)?,
        })
    }

    pub fn value_opt(&self, prop: Option<&Prop>) -> ForgeResult<ValueExpr> {
        prop.map_or(Ok(ValueExpr::Static(Value::Undefined)), |p| self.value(p))
    }

    fn value_node(&self, node: &Arc<Node>) -> ForgeResult<ValueExpr> {
        match &node.kind {
            NodeKind::Block { .. } => {
                let entries = node
                    .props
                    .iter()
                    .map(|(k, v)| Ok((k.clone(), self.value(v)?)))
                    .collect::<ForgeResult<_>>()?;
                Ok(ValueExpr::Block(Arc::new(BlockValue { node: node.clone(), entries })))
            }
            NodeKind::Expr(ExprKind::Conditional) => Ok(ValueExpr::Conditional {
                predicate: self.operand_opt(node.prop("predicate"))?,
                then: Box::new(self.value_opt(node.prop("thenValue"))?),
                otherwise: Box::new(self.value_opt(node.prop("elseValue"))?),
            }),
            NodeKind::Expr(ExprKind::Match) => {
                let mut arms = Vec::new();
                for branch in node.prop("branches").and_then(Prop::as_array).unwrap_or_default() {
                    let Some(b) = branch.as_object() else { continue };
                    let arm = match b.get("expected") {
                        Some(expected) => MatchArm::Expected(self.operand(expected)?),
                        None => MatchArm::Pred(self.branch_pred(b.get("predicate"))?),
                    };
                    arms.push((arm, self.value_opt(b.get("value"))?));
                }
                Ok(ValueExpr::Match {
                    subject: Box::new(self.value_opt(node.prop("subject"))?),
                    arms,
                    otherwise: match node.prop("otherwise") {
                        Some(o) => Some(Box::new(self.value(o)?)),
                        None => None,
                    },
                })
            }
            NodeKind::Expr(ExprKind::Iterate) => {
                let iterator = node.prop("iterator").and_then(Prop::as_object);
                let kind = iterator.and_then(|i| i.get("type")).and_then(Prop::as_str).and_then(iter_kind);
                let input = self.operand_opt(node.prop("input"))?;
                let predicate = || -> ForgeResult<Option<Expr>> {
                    match iterator.and_then(|i| i.get("predicateTemplate")) {
                        Some(p) => Ok(Some(self.operand(p)?)),
                        None => Ok(None),
                    }
                };
                Ok(match kind {
                    Some(IterKind::Map) => ValueExpr::Map {
                        input,
                        yield_: match iterator.and_then(|i| i.get("yieldTemplate")) {
                            Some(y) => Some(Box::new(self.value(y)?)),
                            None => None,
                        },
                    },
                    Some(IterKind::Filter) => ValueExpr::Filter { input, predicate: predicate()? },
                    Some(IterKind::Find) => ValueExpr::Find { input, predicate: predicate()? },
                    Some(_) => ValueExpr::Expr(self.node(node)?),
                    None => ValueExpr::Static(Value::Undefined),
                })
            }
            _ => Ok(ValueExpr::Expr(self.node(node)?)),
        }
    }
}

async fn catching(expr: &Expr, scope: &mut Scope, mode: ErrorMode, fallback: &Value) -> ForgeResult<Value> {
    match mode {
        ErrorMode::Throw => expr.eval(scope).await,
        ErrorMode::Fallback => {
            let depth = scope.frames.len();
            match expr.eval(scope).await {
                Ok(v) => Ok(v),
                Err(_) => {
                    scope.frames.truncate(depth);
                    Ok(fallback.clone())
                }
            }
        }
    }
}

impl ValueExpr {
    /// `RuntimeValueCompiler.compileValue`.
    pub fn eval<'a>(&'a self, scope: &'a mut Scope, policy: &'a ValuePolicy) -> BoxFuture<'a, ForgeResult<Value>> {
        async move {
            match self {
                ValueExpr::Static(v) => Ok(v.clone()),
                ValueExpr::Expr(e) => catching(e, scope, policy.mode, &policy.fallback).await,
                ValueExpr::Record(entries) => {
                    let mut map = Map::new();
                    for (k, v) in entries {
                        map.insert(k.clone(), v.eval(scope, policy).await?);
                    }
                    Ok(Value::object(map))
                }
                ValueExpr::List(items) => {
                    let mut out = Vec::with_capacity(items.len());
                    for item in items {
                        let v = item.eval(scope, policy).await?;
                        if policy.omit_undefined_array_items && v.is_undefined() {
                            continue;
                        }
                        out.push(v);
                    }
                    Ok(Value::array(out))
                }
                ValueExpr::Conditional { predicate, then, otherwise } => {
                    if catching(predicate, scope, policy.mode, &Value::Bool(false)).await?.truthy() {
                        then.eval(scope, policy).await
                    } else {
                        otherwise.eval(scope, policy).await
                    }
                }
                ValueExpr::Match { subject, arms, otherwise } => {
                    let subject = subject.eval(scope, policy).await?;
                    for (arm, value) in arms {
                        let depth = scope.frames.len();
                        let matched = match arm {
                            MatchArm::Expected(e) => e.eval(scope).await.map(|v| Value::Bool(subject.strict_eq(&v))),
                            MatchArm::Pred(p) => p.eval(scope, &subject).await,
                        };
                        let matched = match (matched, policy.mode) {
                            (Ok(v), _) => v,
                            (Err(e), ErrorMode::Throw) => return Err(e),
                            (Err(_), ErrorMode::Fallback) => {
                                scope.frames.truncate(depth);
                                Value::Bool(false)
                            }
                        };
                        if matched.truthy() {
                            return value.eval(scope, policy).await;
                        }
                    }
                    match otherwise {
                        Some(o) => o.eval(scope, policy).await,
                        None => Ok(Value::Undefined),
                    }
                }
                ValueExpr::Map { input, yield_ } => {
                    let input = input.eval(scope).await?;
                    let mut out = Vec::new();
                    let mut items = ItemLoop::new(input);
                    while items.next(scope)?.is_some() {
                        let item = match yield_ {
                            Some(y) => match y.eval(scope, policy).await {
                                Ok(v) => v,
                                Err(e) => {
                                    items.finish(scope);
                                    return Err(e);
                                }
                            },
                            None => Value::Undefined,
                        };
                        if !item.is_undefined() {
                            out.push(item);
                        }
                    }
                    items.finish(scope);
                    Ok(Value::array(out))
                }
                ValueExpr::Filter { input, predicate } | ValueExpr::Find { input, predicate } => {
                    let find = matches!(self, ValueExpr::Find { .. });
                    let input = input.eval(scope).await?;
                    let mut out = Vec::new();
                    let mut found = Value::Undefined;
                    let mut items = ItemLoop::new(input);
                    while let Some(raw) = items.next(scope)? {
                        let hit = match predicate {
                            Some(p) => catching(p, scope, policy.mode, &Value::Bool(false)).await?.truthy(),
                            None => false,
                        };
                        if hit {
                            if find {
                                found = raw;
                                break;
                            }
                            out.push(raw);
                        }
                    }
                    items.finish(scope);
                    Ok(if find { found } else { Value::array(out) })
                }
                ValueExpr::Block(block) => match &policy.blocks {
                    Some(handler) => handler.materialize(block, scope, policy).await,
                    None => Err(crate::engine::errors::ForgeError::evaluation(
                        "A nested block value is only compilable by the resolve concern",
                    )),
                },
            }
        }
        .boxed()
    }
}
