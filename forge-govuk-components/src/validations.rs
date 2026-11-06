//! `GovUKValidations` (utils/govukValidations.ts): ready-made validation sets.

use forge_core::Value;
use forge_core::authoring::{and, condition, not, self_, validation};

/// A message, either a string or `{ message, submissionOnly? }`.
fn to_options(input: &Value) -> (Value, Value) {
    match input {
        Value::Object(_) => {
            let submission_only = match input.get("submissionOnly") {
                Value::Undefined | Value::Null => Value::Bool(false),
                v => v,
            };
            (input.get("message"), submission_only)
        }
        message => (message.clone(), Value::Bool(false)),
    }
}

fn check(condition: Value, opts: (Value, Value), details: Option<Value>) -> Value {
    let mut def = Value::from_pairs([("condition", condition), ("message", opts.0)]);
    if let Some(d) = details {
        def.set("details", d);
    }
    def.set("submissionOnly", opts.1);
    validation(def)
}

/// `GovUKValidations.DateInputFull(messages)`: empty, missing day/month/year, invalid, and
/// optional must-be-past / must-be-future checks for a full date input.
pub fn date_input_full(messages: Value) -> Value {
    let is_object = || self_().matches(condition::object::is_object());
    let lacks = |part: &str| self_().not().matches(condition::object::property_has_value(part));
    let mut out = vec![check(
        not(and(vec![is_object(), lacks("day"), lacks("month"), lacks("year")])),
        to_options(&messages.get("empty")),
        None,
    )];
    for (key, part) in [("missingDay", "day"), ("missingMonth", "month"), ("missingYear", "year")] {
        out.push(check(
            not(and(vec![is_object(), lacks(part)])),
            to_options(&messages.get(key)),
            Some(Value::from_pairs([("field", Value::from(part))])),
        ));
    }
    out.push(check(self_().matches(condition::date::is_valid()), to_options(&messages.get("invalid")), None));
    if messages.get("mustBePast").truthy() {
        out.push(check(self_().not().matches(condition::date::is_future_date()), to_options(&messages.get("mustBePast")), None));
    }
    if messages.get("mustBeFuture").truthy() {
        out.push(check(self_().not().matches(condition::date::is_past_date()), to_options(&messages.get("mustBeFuture")), None));
    }
    Value::array(out)
}
