//! Answer cleardown (port of `concerns/answer-cleardown`): clears answers that belong to steps no
//! reachable path can reach any more, recording a `cleardown` mutation rather than deleting.

use std::sync::Arc;

use regex::Regex;

use crate::engine::analysis::{field_occurrences, FieldCode, FieldModel};
use crate::engine::ast::NodeId;
use crate::engine::concerns::reachability::JourneyReachabilityProjection;
use crate::engine::errors::{ForgeError, ForgeResult};
use crate::engine::expr::Scope;
use crate::engine::runtime::context::{Answers, SharedContext};
use crate::value::Value;

/// The field codes one step can store (`StepFieldInventory`).
#[derive(Clone, Debug)]
pub struct StepFieldInventory {
    pub step_id: NodeId,
    pub field_codes: Vec<String>,
    pub cleardown_field_codes: Vec<String>,
}

struct InventoryStep {
    step_id: NodeId,
    fields: Vec<Arc<FieldModel>>,
    cleardown_field_codes: Vec<String>,
}

/// `StepFieldInventoryCompiler`.
pub struct CompiledFieldInventory {
    steps: Vec<InventoryStep>,
}

impl CompiledFieldInventory {
    pub fn new(steps: Vec<(NodeId, Vec<Arc<FieldModel>>, Vec<String>)>) -> Self {
        Self {
            steps: steps
                .into_iter()
                .map(|(step_id, fields, cleardown_field_codes)| InventoryStep { step_id, fields, cleardown_field_codes })
                .collect(),
        }
    }

    pub async fn evaluate(&self, ctx: &SharedContext) -> ForgeResult<Vec<StepFieldInventory>> {
        let mut out = Vec::with_capacity(self.steps.len());
        for step in &self.steps {
            let mut codes: Vec<String> = Vec::new();
            let only_static = step
                .fields
                .iter()
                .all(|f| f.iterator_path.is_empty() && !matches!(f.code, Some(FieldCode::Dynamic(_))));
            if only_static {
                for f in &step.fields {
                    if let Some(FieldCode::Static(c)) = &f.code {
                        codes.push(c.to_string());
                    }
                }
            } else {
                let mut scope = Scope::new(ctx.clone());
                for occ in field_occurrences(&step.fields, &mut scope).await? {
                    let mut s = Scope { ctx: ctx.clone(), frames: occ.frames.clone(), self_code: None };
                    match &occ.field.code {
                        Some(FieldCode::Static(c)) => codes.push(c.to_string()),
                        Some(FieldCode::Dynamic(e)) => codes.push(e.eval(&mut s).await?.to_js_string()),
                        None => {}
                    }
                }
            }
            let mut unique: Vec<String> = Vec::new();
            for c in codes {
                if !unique.contains(&c) {
                    unique.push(c);
                }
            }
            out.push(StepFieldInventory {
                step_id: step.step_id.clone(),
                field_codes: unique,
                cleardown_field_codes: step.cleardown_field_codes.clone(),
            });
        }
        Ok(out)
    }
}

/// `evaluateAnswerCleardown`: clears stale answers in place and returns the cleared codes.
pub fn evaluate_answer_cleardown(reachability: &JourneyReachabilityProjection, answers: &mut Answers) -> ForgeResult<Vec<String>> {
    if answers.is_empty() {
        return Ok(Vec::new());
    }
    let mut to_clear: Vec<String> = Vec::new();
    let add = |code: &str, list: &mut Vec<String>| {
        if !list.iter().any(|c| c == code) {
            list.push(code.to_string());
        }
    };
    for step in &reachability.unreachable_steps {
        for code in &step.field_codes {
            if answers.contains_key(code.as_str()) {
                add(code, &mut to_clear);
            }
        }
    }
    let matchers = reachability
        .unreachable_steps
        .iter()
        .flat_map(|s| s.cleardown_field_codes.iter())
        .map(|p| Regex::new(p).map_err(|e| ForgeError::evaluation(format!("Invalid regular expression: /{p}/: {e}"))))
        .collect::<ForgeResult<Vec<_>>>()?;
    if !matchers.is_empty() {
        for key in answers.keys() {
            if matchers.iter().any(|m| m.is_match(key)) {
                add(key, &mut to_clear);
            }
        }
    }
    for code in &to_clear {
        if let Some(history) = answers.get_mut(code.as_str())
            && !history.current.is_undefined()
        {
            history.current = Value::Undefined;
            history.parsed = Value::Undefined;
            history.mutations.push(crate::engine::runtime::context::AnswerMutation {
                value: Value::Undefined,
                source: "cleardown".into(),
            });
        }
    }
    Ok(to_clear)
}
