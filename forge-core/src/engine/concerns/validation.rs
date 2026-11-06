//! Validation (port of `concerns/validation` plus the validation helpers of
//! `generatedFunctionRuntimeLibrary`).
//!
//! Two rounds share one compiled step validation: the reachability round (default group, no
//! `submissionOnly` rules) records validity per step for reachability, and the current-page round
//! (`validateOnEntry` on GET, submit hooks on POST) produces the displayed result.

use std::sync::Arc;

use futures::future::BoxFuture;
use futures::FutureExt;

use crate::engine::analysis::{field_occurrences, FieldCode, FieldModel, FieldRules};
use crate::engine::errors::{ForgeError, ForgeResult};
use crate::engine::expr::{instance_id, Expr, RuleValue, Scope, ValidationRule};
use crate::engine::runtime::context::SharedContext;
use crate::engine::tracing::{fields, Span};
use crate::engine::value_expr::ValuePolicy;
use crate::value::{Map, Value};

/// One failed rule (`ValidationResult` / `StepValidationFailure`).
#[derive(Clone, Debug)]
pub struct ValidationResult {
    /// Set for field failures; the render block the failure attaches to.
    pub block_id: Option<Arc<str>>,
    /// Set for field failures; the field's answer code.
    pub block_code: Option<Value>,
    pub passed: bool,
    pub message: Value,
    pub submission_only: bool,
    pub groups: Value,
    pub details: Value,
}

impl ValidationResult {
    /// The JS-shaped failure without `blockId` (`ValidationResult`).
    pub fn to_value(&self) -> Value {
        let mut map = Map::new();
        if let Some(code) = &self.block_code {
            map.insert("blockCode".into(), code.clone());
        }
        map.insert("passed".into(), Value::Bool(self.passed));
        map.insert("message".into(), self.message.clone());
        map.insert("submissionOnly".into(), Value::Bool(self.submission_only));
        map.insert("groups".into(), self.groups.clone());
        map.insert("details".into(), self.details.clone());
        Value::object(map)
    }
}

/// A step's validity under one rule filter (`StepValidityResult`).
#[derive(Clone, Debug, Default)]
pub struct StepValidity {
    pub field_failures: Vec<ValidationResult>,
    pub domain_failures: Vec<ValidationResult>,
}

impl StepValidity {
    pub fn is_valid(&self) -> bool {
        self.field_failures.is_empty() && self.domain_failures.is_empty()
    }
}

/// `ValidationRuleFilter`.
#[derive(Clone, Debug)]
pub struct RuleFilter {
    pub groups: Vec<String>,
    pub include_submission_only: bool,
}

impl RuleFilter {
    /// Reachability round: default group, no submission-only rules.
    pub fn reachability() -> Self {
        Self { groups: vec!["default".into()], include_submission_only: false }
    }

    /// `ruleIsActive`.
    fn is_active(&self, groups: &Value, submission_only: bool) -> bool {
        let requested: Vec<&str> = if self.groups.is_empty() { vec!["default"] } else { self.groups.iter().map(String::as_str).collect() };
        let rule_groups: Vec<String> = match groups {
            Value::Array(g) if !g.is_empty() => g.iter().map(Value::to_js_string).collect(),
            _ => vec!["default".into()],
        };
        if !rule_groups.iter().any(|g| requested.contains(&g.as_str())) {
            return false;
        }
        !submission_only || self.include_submission_only
    }
}

/// The current-page validation result (`ValidationView`).
#[derive(Clone, Debug)]
pub struct ValidationView {
    pub is_valid: bool,
    pub field_failures: Vec<ValidationResult>,
    pub domain_failures: Vec<ValidationResult>,
}

impl From<StepValidity> for ValidationView {
    fn from(v: StepValidity) -> Self {
        Self { is_valid: v.is_valid(), field_failures: v.field_failures, domain_failures: v.domain_failures }
    }
}

/// The compiled validation for one step (`CompiledValidationFunction`).
pub struct CompiledStepValidation {
    /// Fields carrying validation rules, in occurrence order.
    pub fields: Vec<Arc<FieldModel>>,
    pub domain: Option<FieldRules>,
}

/// One rule about to be collected: a compiled rule in its scope, or a plain rule object.
enum PendingRule {
    Compiled { rule: Arc<ValidationRule>, scope: Scope, groups: Value },
    Plain(Value),
}

impl PendingRule {
    fn groups(&self) -> Value {
        match self {
            PendingRule::Compiled { groups, .. } => groups.clone(),
            PendingRule::Plain(v) => v.get("groups"),
        }
    }

    fn submission_only(&self) -> bool {
        match self {
            PendingRule::Compiled { rule, .. } => rule.submission_only,
            PendingRule::Plain(v) => v.get("submissionOnly").strict_eq(&Value::Bool(true)),
        }
    }
}

impl CompiledStepValidation {
    pub fn is_empty(&self) -> bool {
        self.fields.is_empty() && self.domain.is_none()
    }

    /// Runs the step validation as a `validation.step` unit keyed `key` under `parent`. Field
    /// occurrences (codes, `dependentWhen`) are resolved first, as the compiled TS function builds
    /// every `validation.field` task before the step task runs them.
    pub async fn run(&self, ctx: &SharedContext, filter: &RuleFilter, parent: &Span, key: &str) -> ForgeResult<StepValidity> {
        let mut result = StepValidity::default();
        let mut tasks = Vec::new();
        let mut scope = Scope::new(ctx.clone());
        for occ in field_occurrences(&self.fields, &mut scope).await? {
            let field = &occ.field;
            let mut field_scope = Scope { ctx: ctx.clone(), frames: occ.frames.clone(), self_code: None };
            let code = match &field.code {
                Some(FieldCode::Static(c)) => Some(Value::String(c.clone())),
                Some(FieldCode::Dynamic(e)) => Some(Value::from(e.eval(&mut field_scope).await?.to_js_string())),
                None => None,
            };
            field_scope.self_code = code.clone();
            // `dependentWhen` gates whether the field is validated at all.
            if let Some(dw) = &field.dependent_when
                && !dw.eval(&mut field_scope, &ValuePolicy::throwing()).await?.truthy()
            {
                continue;
            }
            let Some(rules) = field.validation.clone() else { continue };
            let indexes: Vec<usize> = occ.frames.iter().map(|f| f.index).collect();
            let block_id: Arc<str> = instance_id(&field.source, &indexes).into();
            tasks.push((block_id, code, rules, field_scope));
        }
        let span = parent.child(key, "validation.step", || {
            fields([
                ("fieldValidations", Value::from(tasks.len())),
                ("domainValidations", Value::from(usize::from(self.domain.is_some()))),
            ])
        });
        for (block_id, code, rules, mut field_scope) in tasks {
            let field_span = span.child(format!("field:{block_id}"), "validation.field", || {
                fields([("blockId", Value::String(block_id.clone())), ("blockCode", code.clone().unwrap_or_default())])
            });
            let pending = collect_rules(&rules, &mut field_scope).await?;
            let failures = run_rules(pending, filter).await?;
            field_span.complete(|| fields([("failures", Value::from(failures.len()))]));
            for failure in failures {
                result.field_failures.push(ValidationResult {
                    block_id: Some(block_id.clone()),
                    block_code: Some(code.clone().unwrap_or_default()),
                    ..failure
                });
            }
        }
        if let Some(rules) = &self.domain {
            let domain_span = span.open("domain:0", "validation.domain");
            let mut domain_scope = Scope::new(ctx.clone());
            let pending = collect_rules(rules, &mut domain_scope).await?;
            result.domain_failures = run_rules(pending, filter).await?;
            domain_span.complete(|| fields([("failures", Value::from(result.domain_failures.len()))]));
        }
        span.complete(|| {
            fields([
                ("fieldFailures", Value::from(result.field_failures.len())),
                ("domainFailures", Value::from(result.domain_failures.len())),
            ])
        });
        Ok(result)
    }
}

/// Evaluates a field's or step's rules into a flat, ordered rule list.
async fn collect_rules(rules: &FieldRules, scope: &mut Scope) -> ForgeResult<Vec<PendingRule>> {
    let value = match rules {
        FieldRules::Direct(direct) => {
            let mut items = Vec::with_capacity(direct.len());
            for rule in direct {
                items.push(Expr::Validation(rule.clone()).eval(scope).await?);
            }
            Value::array(items)
        }
        FieldRules::Dynamic(v) => v.eval(scope, &ValuePolicy::throwing()).await?,
    };
    let mut out = Vec::new();
    flatten_rules(&value, scope, &mut out);
    Ok(out)
}

/// `takeNextActiveValidationRule`'s traversal: depth-first, skipping nullish entries.
fn flatten_rules(value: &Value, scope: &Scope, out: &mut Vec<PendingRule>) {
    match value {
        Value::Undefined | Value::Null => {}
        Value::Array(items) => items.iter().for_each(|i| flatten_rules(i, scope, out)),
        Value::Opaque(_) => {
            if let Some(rv) = value.downcast::<RuleValue>() {
                out.push(PendingRule::Compiled {
                    rule: rv.rule.clone(),
                    scope: Scope { ctx: scope.ctx.clone(), frames: rv.frames.clone(), self_code: rv.self_code.clone() },
                    groups: rv.groups.clone(),
                });
            }
        }
        other => out.push(PendingRule::Plain(other.clone())),
    }
}

/// `collectValidationFailures`: filters each rule before evaluating it.
fn run_rules(rules: Vec<PendingRule>, filter: &RuleFilter) -> BoxFuture<'_, ForgeResult<Vec<ValidationResult>>> {
    async move {
        let mut failures = Vec::new();
        for rule in rules {
            if !filter.is_active(&rule.groups(), rule.submission_only()) {
                continue;
            }
            let submission_only = rule.submission_only();
            let groups = rule.groups();
            match rule {
                PendingRule::Compiled { rule, mut scope, .. } => {
                    let passed = match rule.condition.eval(&mut scope).await {
                        Ok(v) => v.truthy(),
                        Err(e) if e.is_type_error() => false,
                        Err(e) => return Err(e),
                    };
                    if passed {
                        continue;
                    }
                    let message = rule.message.eval(&mut scope).await?;
                    let details = match &rule.details {
                        Some(d) => d.eval(&mut scope).await?,
                        None => Value::Undefined,
                    };
                    failures.push(failure(message, details, submission_only, groups));
                }
                PendingRule::Plain(v) => {
                    if v.get("passed").truthy() {
                        continue;
                    }
                    let message = match v.get("message") {
                        Value::Undefined => Value::string(""),
                        m => m,
                    };
                    failures.push(failure(message, v.get("details"), submission_only, groups));
                }
            }
        }
        Ok(failures)
    }
    .boxed()
}

fn failure(message: Value, details: Value, submission_only: bool, groups: Value) -> ValidationResult {
    ValidationResult { block_id: None, block_code: None, passed: false, message, submission_only, groups, details }
}

/// `validateOnEntry` group selection (`EntryValidationCompiler`).
pub struct CompiledEntryValidation {
    pub entries: Vec<(Vec<String>, Option<Expr>)>,
}

impl CompiledEntryValidation {
    /// Groups whose `when` holds, each once, in first-declared order.
    pub async fn select_groups(&self, ctx: &SharedContext) -> ForgeResult<Vec<String>> {
        let mut groups: Vec<String> = Vec::new();
        let mut scope = Scope::new(ctx.clone());
        for (entry_groups, when) in &self.entries {
            if let Some(w) = when
                && !w.eval(&mut scope).await?.truthy()
            {
                continue;
            }
            for g in entry_groups {
                if !groups.contains(g) {
                    groups.push(g.clone());
                }
            }
        }
        Ok(groups)
    }
}

pub fn internal(message: &str) -> ForgeError {
    ForgeError::evaluation(message)
}
