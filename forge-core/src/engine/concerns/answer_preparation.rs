//! Answer preparation (port of `concerns/answer-preparation` plus the answer helpers of
//! `generatedFunctionRuntimeLibrary`).
//!
//! On POST each field's submitted value is normalised, checked against the component input
//! schema, recorded as a `post` mutation and passed through its formatters (`processed`). On GET
//! the stored answer is kept, or the authored default is seeded (`default`), and parsers produce
//! `parsed`. Fields that share a code form one variant group, where the first variant whose
//! `dependentWhen` holds is the active one.

use std::sync::Arc;

use indexmap::IndexMap;

use crate::engine::analysis::{field_occurrences, FieldCode, FieldModel};
use crate::engine::errors::ForgeResult;
use crate::engine::expr::{Call, Scope};
use crate::engine::registries::ComponentRegistry;
use crate::engine::runtime::context::{AnswerHistory, SharedContext};
use crate::engine::value_expr::ValuePolicy;
use crate::engine::tracing::{fields, LateField, Span};
use crate::value::Value;

/// The compiled answer preparation for a step or journey.
pub struct CompiledAnswerPreparation {
    pub fields: Vec<Arc<FieldModel>>,
}

/// One field definition after its code has been resolved (`PreparedFieldDefinition`).
struct FieldDefinition {
    code: Arc<str>,
    field: Arc<FieldModel>,
    scope: Scope,
}

/// Values are evaluated with the throw policy (`StepAnswerPreparationCompiler`).
fn policy() -> ValuePolicy {
    ValuePolicy::throwing()
}

impl CompiledAnswerPreparation {
    /// Runs as the `answer.preparation` unit under `parent`, one `answer.preparation.field` unit
    /// per code group.
    pub async fn run(&self, ctx: &SharedContext, components: &ComponentRegistry, parent: &Span) -> ForgeResult<()> {
        let span = parent.open("answer-preparation", "answer.preparation");
        // TS records the live answers record, so the trace shows it as of the end of the request.
        span.late_field("answers", LateField::Answers);
        self.prepare(ctx, components, &span).await?;
        span.done();
        Ok(())
    }

    async fn prepare(&self, ctx: &SharedContext, components: &ComponentRegistry, span: &Span) -> ForgeResult<()> {
        if self.fields.is_empty() {
            return Ok(());
        }
        let is_post = ctx.lock().request.method == "POST";
        let mode = if is_post { "POST" } else { "GET" };
        let mut scope = Scope::new(ctx.clone());
        let occurrences = field_occurrences(&self.fields, &mut scope).await?;

        let mut definitions = Vec::new();
        for occ in occurrences {
            let mut occ_scope = Scope { ctx: ctx.clone(), frames: occ.frames.clone(), self_code: None };
            let code = match &occ.field.code {
                Some(FieldCode::Static(c)) => Some(Value::String(c.clone())),
                Some(FieldCode::Dynamic(e)) => Some(Value::from(e.eval(&mut occ_scope).await?.to_js_string())),
                None => None,
            };
            if occ.field.iterator_path.is_empty() && code.is_none() {
                continue;
            }
            if let Some(c) = &code {
                occ_scope.self_code = Some(c.clone());
            }
            let code: Arc<str> = code.map_or_else(|| "undefined".into(), |c| c.to_js_string().into());
            definitions.push(FieldDefinition { code, field: occ.field, scope: occ_scope });
        }

        for group in group_by_code(definitions) {
            let code = group[0].code.clone();
            let field = span.child(format!("field:{code}"), "answer.preparation.field", || {
                fields([("code", Value::String(code.clone())), ("mode", Value::from(mode))])
            });
            if is_post {
                prepare_posted_group(ctx, components, group).await?;
            } else {
                prepare_stored_group(ctx, group).await?;
            }
            field.complete(|| {
                let guard = ctx.lock();
                let history = guard.domain.answers.get(code.as_ref());
                fields([
                    ("code", Value::String(code.clone())),
                    ("mode", Value::from(mode)),
                    ("mutationCount", Value::from(history.map_or(0, |h| h.mutations.len()))),
                    ("parsed", Value::Bool(history.is_some_and(|h| !h.parsed.is_undefined()))),
                ])
            });
        }
        Ok(())
    }
}

/// `groupFieldDefinitionsByCode`: groups by code, in first-seen order.
fn group_by_code(definitions: Vec<FieldDefinition>) -> Vec<Vec<FieldDefinition>> {
    let mut groups: IndexMap<Arc<str>, Vec<FieldDefinition>> = IndexMap::new();
    for d in definitions {
        groups.entry(d.code.clone()).or_default().push(d);
    }
    groups.into_values().collect()
}

fn with_history<R>(ctx: &SharedContext, code: &str, f: impl FnOnce(&mut AnswerHistory) -> R) -> R {
    let mut guard = ctx.lock();
    f(guard.domain.answers.entry(code.into()).or_default())
}

/// `normalizePostValue`.
pub fn normalize_post_value(raw: Value, multiple: bool) -> Value {
    if multiple {
        return match raw {
            Value::Array(_) => raw,
            v if v.is_nullish() => Value::array(vec![]),
            v => Value::array(vec![v]),
        };
    }
    match raw {
        Value::Array(items) => items
            .iter()
            .find(|v| !v.is_nullish() && v.as_str().is_none_or(|s| !s.trim().is_empty()))
            .cloned()
            .unwrap_or_default(),
        other => other,
    }
}

/// `checkComponentInputValue`.
pub fn check_component_input(components: &ComponentRegistry, variant: &str, value: Value, multiple: bool) -> Value {
    if value.is_undefined() {
        return value;
    }
    let Some(schema) = components.get(variant).and_then(|c| c.input_schema.as_ref()) else { return value };
    match schema.parse(&value) {
        Ok(parsed) => parsed,
        Err(_) if multiple => Value::array(vec![]),
        Err(_) => Value::Undefined,
    }
}

/// A formatter/parser chain: each defined result replaces the value; a `TypeError` anywhere
/// abandons the chain and returns the original value.
async fn run_transformers(calls: &[Call], value: Value, scope: &mut Scope) -> ForgeResult<Value> {
    let mut transformed = value.clone();
    for call in calls {
        match call.eval(scope, Some(transformed.clone())).await {
            Ok(result) => {
                if !result.is_undefined() {
                    transformed = result;
                }
            }
            Err(e) if e.is_type_error() => return Ok(value),
            Err(e) => return Err(e),
        }
    }
    Ok(transformed)
}

async fn dependent_when_holds(def: &mut FieldDefinition) -> ForgeResult<Option<bool>> {
    let Some(dw) = &def.field.dependent_when else { return Ok(None) };
    Ok(Some(dw.eval(&mut def.scope, &policy()).await?.truthy()))
}

/// `findActiveFieldVariant`: the first variant without a `dependentWhen`, or whose holds.
async fn find_active(group: &mut [FieldDefinition]) -> ForgeResult<Option<usize>> {
    for (i, def) in group.iter_mut().enumerate() {
        match dependent_when_holds(def).await? {
            None | Some(true) => return Ok(Some(i)),
            Some(false) => {}
        }
    }
    Ok(None)
}

async fn run_posted_pipeline(ctx: &SharedContext, components: &ComponentRegistry, def: &mut FieldDefinition) -> ForgeResult<()> {
    let component = &def.field.component;
    let raw = ctx.lock().request.post.get(&def.code);
    let mut raw = normalize_post_value(raw, component.multiple);
    if component.validates_input {
        raw = check_component_input(components, &component.variant, raw, component.multiple);
    }
    with_history(ctx, &def.code, |h| h.push(raw.clone(), "post"));
    if let Some(formatters) = &def.field.formatters {
        let formatted = run_transformers(formatters, raw.clone(), &mut def.scope).await?;
        if !formatted.strict_eq(&raw) {
            with_history(ctx, &def.code, |h| h.push(formatted, "processed"));
        }
    }
    Ok(())
}

async fn prepare_posted_group(ctx: &SharedContext, components: &ComponentRegistry, mut group: Vec<FieldDefinition>) -> ForgeResult<()> {
    if group.len() == 1 {
        let def = &mut group[0];
        run_posted_pipeline(ctx, components, def).await?;
        if dependent_when_holds(def).await? == Some(false) {
            with_history(ctx, &def.code, |h| h.push(Value::Undefined, "dependentWhen"));
        }
        return Ok(());
    }
    match find_active(&mut group).await? {
        None => {
            let code = group[0].code.clone();
            with_history(ctx, &code, |h| h.push(Value::Undefined, "dependentWhen"));
        }
        Some(i) => run_posted_pipeline(ctx, components, &mut group[i]).await?,
    }
    Ok(())
}

async fn prepare_stored(ctx: &SharedContext, def: &mut FieldDefinition) -> ForgeResult<()> {
    let current = ctx.lock().domain.answers.get(def.code.as_ref()).map(|h| h.current.clone());
    if current.as_ref().is_none_or(Value::is_undefined) {
        let default = match &def.field.default_value {
            Some(dv) => dv.eval(&mut def.scope, &policy()).await?,
            None => Value::Undefined,
        };
        with_history(ctx, &def.code, |h| h.push(default, "default"));
    }
    let current = ctx.lock().domain.answers.get(def.code.as_ref()).map(|h| h.current.clone()).unwrap_or_default();
    if !current.is_undefined()
        && let Some(parsers) = &def.field.parsers
    {
        let parsed = run_transformers(parsers, current, &mut def.scope).await?;
        if !parsed.is_undefined() {
            with_history(ctx, &def.code, |h| h.parsed = parsed);
        }
    }
    Ok(())
}

async fn prepare_stored_group(ctx: &SharedContext, mut group: Vec<FieldDefinition>) -> ForgeResult<()> {
    if group.len() == 1 {
        return prepare_stored(ctx, &mut group[0]).await;
    }
    if let Some(i) = find_active(&mut group).await? {
        prepare_stored(ctx, &mut group[i]).await?;
    }
    Ok(())
}
