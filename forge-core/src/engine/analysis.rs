//! Shared compile-time analysis (port of `chassis/compilation/analysis/shared`): ownership of
//! fields and iterators by step, field models, ancestry helpers, static data.

use std::collections::HashMap;
use std::sync::Arc;

use futures::future::BoxFuture;
use futures::FutureExt;

use crate::engine::ast::{AstIndex, ExprKind, Node, NodeId, NodeKind, Prop};
use crate::engine::errors::{ForgeError, ForgeResult};
use crate::engine::expr::{Call, ExprCompiler, Expr, Frame, ItemLoop, Scope, ValidationRule};
use crate::engine::registries::ComponentRegistry;
use crate::engine::value_expr::ValueExpr;
use crate::value::{Map, Value};

/// Fields and iterators bucketed by owning step (`OwnershipIndex`).
#[derive(Default)]
pub struct Ownership {
    pub journey_steps: HashMap<NodeId, Vec<Arc<Node>>>,
    pub field_blocks: HashMap<NodeId, Vec<Arc<Node>>>,
    pub map_iterates: HashMap<NodeId, Vec<Arc<Node>>>,
    pub all_iterates: HashMap<NodeId, Vec<Arc<Node>>>,
}

impl Ownership {
    pub fn build(index: &AstIndex) -> Self {
        let mut o = Ownership::default();
        let nodes = || index.order.iter().filter_map(|id| index.get(id));
        for n in nodes().filter(|n| n.kind == NodeKind::Journey) {
            o.journey_steps.insert(n.id.clone(), Vec::new());
        }
        for step in nodes().filter(|n| n.kind == NodeKind::Step) {
            o.field_blocks.insert(step.id.clone(), Vec::new());
            o.map_iterates.insert(step.id.clone(), Vec::new());
            o.all_iterates.insert(step.id.clone(), Vec::new());
            if let Some(parent) = index.parent(&step.id).filter(|p| p.kind == NodeKind::Journey) {
                o.journey_steps.entry(parent.id.clone()).or_default().push(step.clone());
            }
        }
        for field in nodes().filter(|n| n.is_field_block()) {
            if let Some(step) = nearest_step(index, &field.id) {
                o.field_blocks.entry(step).or_default().push(field.clone());
            }
        }
        for it in nodes().filter(|n| n.expr_kind() == Some(ExprKind::Iterate)) {
            let Some(step) = nearest_step(index, &it.id) else { continue };
            o.all_iterates.entry(step.clone()).or_default().push(it.clone());
            if iterator_type(it) == Some("IteratorType.Map") {
                o.map_iterates.entry(step).or_default().push(it.clone());
            }
        }
        o
    }

    pub fn steps_of(&self, journey: &str) -> &[Arc<Node>] {
        self.journey_steps.get(journey).map(Vec::as_slice).unwrap_or_default()
    }

    pub fn fields_of(&self, step: &str) -> &[Arc<Node>] {
        self.field_blocks.get(step).map(Vec::as_slice).unwrap_or_default()
    }

    pub fn map_iterates_of(&self, step: &str) -> &[Arc<Node>] {
        self.map_iterates.get(step).map(Vec::as_slice).unwrap_or_default()
    }

    pub fn all_iterates_of(&self, step: &str) -> &[Arc<Node>] {
        self.all_iterates.get(step).map(Vec::as_slice).unwrap_or_default()
    }
}

fn nearest_step(index: &AstIndex, id: &str) -> Option<NodeId> {
    if index.get(id).is_some_and(|n| n.kind == NodeKind::Step) {
        return Some(id.into());
    }
    index.ancestors(id).into_iter().find(|n| n.kind == NodeKind::Step).map(|n| n.id.clone())
}

pub fn iterator_type(node: &Node) -> Option<&str> {
    node.prop("iterator").and_then(Prop::as_object).and_then(|i| i.get("type")).and_then(Prop::as_str)
}

/// Static data merged root-first so descendants override ancestors (`resolveStaticData`).
pub fn static_data(index: &AstIndex, node: &Arc<Node>) -> Map {
    let mut chain = index.ancestors(&node.id);
    chain.reverse();
    chain.push(node.clone());
    let mut data = Map::new();
    for n in chain {
        if let Some(Value::Object(d)) = n.prop("data").map(Prop::to_static_value) {
            for (k, v) in d.iter() {
                data.insert(k.clone(), v.clone());
            }
        }
    }
    data
}

#[derive(Clone, Debug)]
pub enum FieldCode {
    Static(Arc<str>),
    Dynamic(Expr),
}

#[derive(Clone, Debug)]
pub struct FieldComponent {
    pub variant: Arc<str>,
    pub multiple: bool,
    pub validates_input: bool,
}

#[derive(Clone, Debug)]
pub enum FieldRules {
    /// Every entry is a validation node.
    Direct(Vec<Arc<ValidationRule>>),
    /// Rules computed at runtime (iterators yielding rules, conditionals...).
    Dynamic(ValueExpr),
}

/// An iterator a field sits inside, with its compiled input.
#[derive(Clone, Debug)]
pub struct IterRef {
    pub node: Arc<Node>,
    pub input: Expr,
}

/// One field occurrence: a registered block, or a template field under MAP iterators.
#[derive(Debug)]
pub struct FieldModel {
    pub source: Arc<Node>,
    pub iterator_path: Vec<IterRef>,
    pub code: Option<FieldCode>,
    pub component: FieldComponent,
    pub formatters: Option<Vec<Call>>,
    pub parsers: Option<Vec<Call>>,
    pub default_value: Option<ValueExpr>,
    pub dependent_when: Option<ValueExpr>,
    pub validation: Option<FieldRules>,
    pub label: String,
}

/// `FieldModelBuilder`.
pub struct FieldModelBuilder<'a> {
    pub components: &'a ComponentRegistry,
    pub exprs: &'a ExprCompiler<'a>,
}

impl FieldModelBuilder<'_> {
    pub fn build_step_fields(&self, field_blocks: &[Arc<Node>], map_iterates: &[Arc<Node>]) -> ForgeResult<Vec<Arc<FieldModel>>> {
        let mut fields = Vec::new();
        for block in field_blocks {
            fields.push(Arc::new(self.build_field(block, Vec::new())?));
        }
        for it in map_iterates {
            if let Some(template) = map_yield(it) {
                let path = vec![IterRef { node: it.clone(), input: self.exprs.operand_opt(it.prop("input"))? }];
                self.collect_template_fields(template, &path, &mut fields)?;
            }
        }
        Ok(fields)
    }

    fn collect_template_fields(&self, prop: &Prop, path: &[IterRef], out: &mut Vec<Arc<FieldModel>>) -> ForgeResult<()> {
        match prop {
            Prop::Lit(_) => Ok(()),
            Prop::Array(items) => items.iter().try_for_each(|p| self.collect_template_fields(p, path, out)),
            Prop::Object(o) => o.values().try_for_each(|p| self.collect_template_fields(p, path, out)),
            Prop::Node(node) => {
                if node.expr_kind() == Some(ExprKind::Iterate) {
                    if let Some(template) = map_yield(node) {
                        let mut nested = path.to_vec();
                        nested.push(IterRef { node: node.clone(), input: self.exprs.operand_opt(node.prop("input"))? });
                        self.collect_template_fields(template, &nested, out)?;
                    }
                    return Ok(());
                }
                if node.is_field_block() {
                    out.push(Arc::new(self.build_field(node, path.to_vec())?));
                }
                node.props.values().try_for_each(|p| self.collect_template_fields(p, path, out))
            }
        }
    }

    fn build_field(&self, block: &Arc<Node>, iterator_path: Vec<IterRef>) -> ForgeResult<FieldModel> {
        let code = match block.prop("code") {
            Some(Prop::Lit(Value::String(s))) => Some(FieldCode::Static(s.clone())),
            Some(Prop::Node(n)) => Some(FieldCode::Dynamic(self.exprs.node(n)?)),
            _ => None,
        };
        let variant = block.variant().cloned().unwrap_or_default();
        let component = if variant.is_empty() {
            FieldComponent { variant: variant.clone(), multiple: false, validates_input: false }
        } else {
            let entry = self
                .components
                .get(&variant)
                .ok_or_else(|| ForgeError::UnregisteredComponent { variant: variant.to_string() })?;
            FieldComponent { variant: variant.clone(), multiple: entry.multiple, validates_input: entry.input_schema.is_some() }
        };
        let label = {
            let v = if variant.is_empty() { "unknown component".to_string() } else { variant.to_string() };
            match &code {
                None => v,
                Some(FieldCode::Static(c)) => format!("{v} \"{c}\""),
                Some(FieldCode::Dynamic(_)) => format!("{v} (dynamic code)"),
            }
        };
        Ok(FieldModel {
            source: block.clone(),
            iterator_path,
            code,
            component,
            formatters: self.transformers(block.prop("formatters"))?,
            parsers: self.transformers(block.prop("parsers"))?,
            default_value: match block.prop("defaultValue") {
                Some(p) if !p.is_undefined() => Some(self.exprs.value(p)?),
                _ => None,
            },
            dependent_when: match block.prop("dependentWhen") {
                Some(Prop::Node(n)) => Some(self.exprs.value(&Prop::Node(n.clone()))?),
                _ => None,
            },
            validation: self.rules(block.prop("validWhen"))?,
            label,
        })
    }

    fn transformers(&self, prop: Option<&Prop>) -> ForgeResult<Option<Vec<Call>>> {
        let Some(items) = prop.and_then(Prop::as_array) else { return Ok(None) };
        let mut calls = Vec::new();
        for item in items {
            let Some(node) = item.as_node() else { continue };
            if node.expr_kind() != Some(ExprKind::Transformer) {
                return Err(ForgeError::evaluation("Formatter entry is not a transformer function call"));
            }
            calls.push(self.exprs.call(node, Some(Expr::Lit(Value::Undefined)))?);
        }
        Ok((!calls.is_empty()).then_some(calls))
    }

    /// `classifyValidation` / `classifyValidationRules`.
    pub fn rules(&self, prop: Option<&Prop>) -> ForgeResult<Option<FieldRules>> {
        compile_rules(self.exprs, prop)
    }
}

/// Classifies a `validWhen` value into direct rules or a dynamic value (`classifyValidationRules`).
pub fn compile_rules(exprs: &ExprCompiler<'_>, prop: Option<&Prop>) -> ForgeResult<Option<FieldRules>> {
    let Some(prop) = prop else { return Ok(None) };
    match prop {
        Prop::Lit(Value::Undefined) => return Ok(None),
        Prop::Array(items) if items.is_empty() => return Ok(None),
        _ => {}
    }
    if let Prop::Array(items) = prop {
        let direct: Vec<_> = items
            .iter()
            .filter_map(|p| p.as_node().filter(|n| n.expr_kind() == Some(ExprKind::Validation)))
            .collect();
        if direct.len() == items.len() {
            let mut rules = Vec::new();
            for node in direct {
                if let Expr::Validation(rule) = exprs.node(node)? {
                    rules.push(rule);
                }
            }
            return Ok(Some(FieldRules::Direct(rules)));
        }
    }
    Ok(Some(FieldRules::Dynamic(exprs.value(prop)?)))
}

fn map_yield(node: &Node) -> Option<&Prop> {
    if iterator_type(node) != Some("IteratorType.Map") {
        return None;
    }
    node.prop("iterator").and_then(Prop::as_object).and_then(|i| i.get("yieldTemplate"))
}

/// One field instance found by running its iterator loops: the model and its loop frames.
#[derive(Clone)]
pub struct Occurrence {
    pub field: Arc<FieldModel>,
    pub frames: Vec<Frame>,
}

/// Runs the iterator loops fields sit inside, grouping consecutive fields that share a loop
/// (`ScopedTemplateCompiler.compileFieldOccurrences`), and returns every occurrence in order.
pub async fn field_occurrences(fields: &[Arc<FieldModel>], scope: &mut Scope) -> ForgeResult<Vec<Occurrence>> {
    let mut out = Vec::new();
    occurrences_at(fields, 0, scope, &mut out).await?;
    Ok(out)
}

fn occurrences_at<'a>(
    fields: &'a [Arc<FieldModel>],
    depth: usize,
    scope: &'a mut Scope,
    out: &'a mut Vec<Occurrence>,
) -> BoxFuture<'a, ForgeResult<()>> {
    async move {
        let mut start = 0;
        while start < fields.len() {
            let key = fields[start].iterator_path.get(depth).map(|r| r.node.clone());
            let mut end = start + 1;
            while end < fields.len()
                && same_node(fields[end].iterator_path.get(depth).map(|r| &r.node), key.as_ref())
            {
                end += 1;
            }
            let run = &fields[start..end];
            match key {
                None => {
                    for f in run {
                        out.push(Occurrence { field: f.clone(), frames: scope.frames.clone() });
                    }
                }
                Some(_) => {
                    let input = run[0].iterator_path[depth].input.eval(scope).await?;
                    let mut items = ItemLoop::new(input);
                    while items.next(scope)?.is_some() {
                        if let Err(e) = occurrences_at(run, depth + 1, scope, out).await {
                            items.finish(scope);
                            return Err(e);
                        }
                    }
                    items.finish(scope);
                }
            }
            start = end;
        }
        Ok(())
    }
    .boxed()
}

fn same_node(a: Option<&Arc<Node>>, b: Option<&Arc<Node>>) -> bool {
    match (a, b) {
        (None, None) => true,
        (Some(x), Some(y)) => Arc::ptr_eq(x, y),
        _ => false,
    }
}
