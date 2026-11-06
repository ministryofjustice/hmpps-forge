---
title: Custom conditions
section: building-functions-and-components
path: building-functions-and-components/custom-conditions
teaches: [FunctionEntry, condition-helpers, with_input, with_arguments, condition-implementation]
prerequisites: [condition, match-method, predicate, ForgePackage]
---

<p class="govuk-caption-xl">Functions</p>

# Building custom conditions

Forge ships with conditions for common checks: required fields,
string lengths, date ranges, array membership, and more. When your
application needs domain-specific validation or visibility logic,
you can define your own conditions. They work the same way as the
built-in set and can be used anywhere `.matches()` is accepted.

{{slot:toc}}

---

## Declaring conditions

Custom conditions are declared as `FunctionEntry::condition`
entries. You collect the entries in a function that returns them,
and give each condition a small helper function for use in journey
definitions:

```rust
use std::sync::LazyLock;

use forge_core::authoring::condition;
use forge_core::{ForgeError, FunctionEntry, Value};
use regex::Regex;

static NI_NUMBER: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(?i)^[A-Z]{2}\d{6}[A-D]$").unwrap());

pub fn my_conditions() -> Vec<FunctionEntry> {
    vec![
        // Checks that a numeric value meets the minimum score threshold.
        // args[0] - the minimum value required for eligibility.
        FunctionEntry::condition("IsEligible", |value, args| {
            let Some(value) = value.as_f64() else {
                return Err(ForgeError::type_error("IsEligible expects a number"));
            };

            Ok(Some(value) >= args[0].as_f64())
        }),
        // Validates that the value is a correctly formatted UK National Insurance number.
        FunctionEntry::condition("IsValidNiNumber", |value, _args| {
            let Some(value) = value.as_str() else {
                return Err(ForgeError::type_error("IsValidNiNumber expects a string"));
            };

            Ok(NI_NUMBER.is_match(&value.replace(char::is_whitespace, "")))
        }),
        // Checks that a date string falls before the given deadline.
        // args[0] - an ISO date string representing the cutoff date.
        FunctionEntry::condition("IsBeforeDeadline", |value, args| {
            let Some(value) = value.as_str() else {
                return Err(ForgeError::type_error("IsBeforeDeadline expects a date string"));
            };

            // ISO dates (YYYY-MM-DD) sort in date order
            Ok(args[0].as_str().is_some_and(|deadline| value < deadline))
        }),
    ]
}

/// Checks that a numeric value meets the minimum score threshold.
pub fn is_eligible(min_score: impl Into<Value>) -> Value {
    condition::call("IsEligible", vec![min_score.into()])
}

/// Validates that the value is a correctly formatted UK National Insurance number.
pub fn is_valid_ni_number() -> Value {
    condition::call("IsValidNiNumber", vec![])
}

/// Checks that a date string falls before the given deadline.
pub fn is_before_deadline(deadline: impl Into<Value>) -> Value {
    condition::call("IsBeforeDeadline", vec![deadline.into()])
}
```

Each `FunctionEntry::condition` call takes a name and a closure
following the pattern `|value, args| -> ForgeResult<bool>`.
`condition::call("IsEligible", vec![Value::from(50)])` creates a
condition expression that Forge evaluates through `.matches()`. The
helper functions are optional: `is_eligible(50)` is just that call
with the name filled in, and gives the condition a typed signature
and a doc comment.

Arguments passed to a condition can be static values or expressions:

```rust
// Static argument
answer("score").matches(condition::call("IsEligible", vec![Value::from(50)]))
// Dynamic argument
answer("score").matches(condition::call("IsEligible", vec![data("minimumScore").into()]))
```

Arguments are `Value`s, so a helper that takes `impl Into<Value>`
accepts both numbers and expressions - the built-in conditions do
the same. Forge resolves the expression before the evaluator runs.

### The value parameter

The first parameter of every condition closure is the resolved
value from the reference it is matched against. When you write
`answer("score").matches(condition::call("IsEligible", vec![Value::from(50)]))`, Forge resolves
`answer("score")` to a concrete value and passes it as the first
argument to the evaluator.

The value is an untyped `Value` because it depends on what the
reference resolves to at runtime. Verify the type before operating
on it, or declare an input schema (see below) to have Forge check
it for you.

### Return value

Conditions must return a boolean. `true` means the condition
passes. `false` means it fails. Forge uses this result directly
for validation, visibility, and hook guards.

Conditions describe when something **is** valid, not when it is
invalid. This keeps the logic consistent across `validWhen`,
`visibleWhen`, and `dependentWhen`. To test for the opposite, the
definition uses `.not().matches()`:

```rust
answer("date").not().matches(condition::call("IsBeforeDeadline", vec!["2026-12-31".into()]))
```

---

## Validating inputs and arguments

A `FunctionEntry` accepts `Schema`s that Forge applies before your
evaluator runs. This is the declarative alternative to manual type
checks:

- **`with_input`** validates the resolved value.
- **`with_arguments`** validates the author-supplied arguments. It
  is a `Schema::Tuple` describing each positional argument.
- **`with_output`** validates the return value. Conditions default
  to `Schema::Boolean`, so you rarely need to set this.

```rust
use forge_core::schema::Schema;

FunctionEntry::condition("IsEligible", |value, args| {
    Ok(value.as_f64() >= args[0].as_f64())
})
.with_input(Schema::number())
.with_arguments(Schema::Tuple(vec![Schema::nonnegative_number()]))
```

With `with_input(Schema::number())` in place, a non-numeric value never
reaches the evaluator — the condition simply evaluates to `false`.
An unanswered or wrongly-shaped field is a normal "not valid yet"
outcome for a condition, not a bug, so it fails soft. That lets the
closure drop the manual type guard.

A failed arguments schema is different: passing a negative
threshold is an author mistake, so Forge returns a
`ForgeError::Type` when the condition is evaluated.

Schemas run at request time, each time the condition is evaluated —
not when the journey is built.

Argument-count mismatches against a tuple schema are additionally caught at `register_package()` by semantic analysis, so a call with the wrong number of arguments fails compilation instead of waiting for request time.

---

## Author-time preparation

The helper function runs when the definition is built. Use it to
sanitise or reshape arguments before they enter the expression
tree, and to reject invalid arguments early — when the journey is
built rather than at render time.

The helper receives only the arguments the author passed, and
decides what goes into the built expression.

```rust
/// Checks that a numeric value meets the minimum score threshold.
pub fn is_eligible(min_score: i64) -> Value {
    assert!(min_score >= 0, "IsEligible requires a non-negative integer");

    condition::call("IsEligible", vec![Value::from(min_score)])
}
```

A bad call fails as soon as the definition is built:

```rust
// Panics with 'IsEligible requires a non-negative integer'.
is_eligible(-1)
```

The helper does not see services or the runtime value,
so it can only check structural properties of the arguments:
required fields, numeric ranges, enum membership, or combinations
like `min <= max`. Checks that depend on the resolved value belong
inside the evaluator.

If an argument is itself an expression like `data("minimumScore")`,
its resolved value is not available at author time. Validate the
resolved value inside the evaluator instead.

An arguments schema and a helper overlap: a schema validates
arguments, a helper can both validate and reshape them. They also
run at different times — the helper runs once, when the definition
is built; the arguments schema runs at request time, each time the
condition is evaluated. Reach for an arguments schema when you only
need to check the arguments, and a helper when you need to
transform them or fail as early as possible. Only the schema also
covers `condition::call` used directly.

---

## Type checking with ForgeError::Type

Condition inputs are resolved at runtime. You cannot rely on the
Rust compiler to catch a mismatch between the reference type and
what the condition expects. When you have not declared an input
schema, verify the type at the start of your evaluator and return
`ForgeError::type_error(...)`.

```rust
FunctionEntry::condition("IsValidNiNumber", |value, _args| {
    let Some(value) = value.as_str() else {
        return Err(ForgeError::type_error("IsValidNiNumber expects a string"));
    };

    Ok(NI_NUMBER.is_match(&value.replace(char::is_whitespace, "")))
})
```

Forge treats `ForgeError::Type` differently depending on context:

- **Outside validation** (in `visibleWhen`, `dependentWhen`, hook
  guards), a type error immediately surfaces as a configuration
  error. This makes mismatches obvious during development.
- **Inside `validWhen`**, a type error is caught and treated as a
  validation failure. This is safe because the field will show an
  error message and the user can correct their input.

Use `ForgeError::type_error` specifically, not another error, so
Forge can distinguish type mismatches from other failures.

---

## Registration

Pass the entries to a package with `with_functions()`. Conditions
that need services take them as an argument:

```rust
use forge_core::ForgePackage;

pub fn my_package(services: Arc<Services>) -> ForgePackage {
    ForgePackage::new(my_journey()).with_functions(my_conditions(services))
}
```

Call `with_functions()` once per group when a package mixes
conditions, transformers, generators, and effects:

```rust
ForgePackage::new(my_journey())
    .with_functions(my_conditions(services.clone()))
    .with_functions(my_transformers())
    .with_functions(my_effects(services.clone()))
```

Services are captured by the closures when the entries are built:

```rust
pub fn my_conditions(services: Arc<Services>) -> Vec<FunctionEntry> {
    let eligibility_service = services.eligibility_service.clone();
    vec![FunctionEntry::condition("IsEligible", move |value, args| {
        Ok(eligibility_service.is_eligible(value, &args[0]))
    })]
}
```

To make conditions available to every journey rather than a single
package, register the entries globally instead:

```rust
forge.register_global_functions(my_conditions(services.clone()))?;
```

---

## Using custom conditions

Custom conditions work the same way as built-in conditions. They
are used through `.matches()` on references.

### In validation

```rust
"validWhen": [
    validation(obj! {
        "condition": self_().matches(condition::call("IsValidNiNumber", vec![])),
        "message": "Enter a valid National Insurance number",
    }),
],
```

### In visibility

```rust
govuk::INSET_TEXT.build(obj! {
    "text": "You are eligible for the programme.",
    "visibleWhen": answer("score").matches(condition::call("IsEligible", vec![Value::from(50)])),
})
```

### In hooks

```rust
access(obj! {
    "when": answer("submissionDate").not().matches(condition::call("IsBeforeDeadline", vec![data("deadline").into()])),
    "next": [redirect(obj! { "goto": "/deadline-passed" })],
})
```

### With combinators

Custom conditions compose with `and`, `or`, `not`, and `xor` the
same way built-in conditions do:

```rust
validation(obj! {
    "condition": and(vec![self_().matches(condition::is_required()), self_().matches(condition::call("IsValidNiNumber", vec![]))]),
    "message": "Enter a valid National Insurance number",
})
```

---

## Testing

A `FunctionEntry` can be evaluated directly with `call()`, which
takes the value followed by the arguments. Find the entry by name
and call it from an async test:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use forge_core::{FunctionEntry, Value};

    fn condition(name: &str) -> FunctionEntry {
        my_conditions().into_iter().find(|f| &*f.name == name).unwrap()
    }

    async fn evaluate(name: &str, args: Vec<Value>) -> forge_core::ForgeResult<Value> {
        condition(name).call(args).await
    }

    mod is_eligible {
        use super::*;

        #[tokio::test]
        async fn should_return_true_when_value_meets_minimum_score() {
            // Arrange / Act / Assert
            assert_eq!(evaluate("IsEligible", vec![75.into(), 50.into()]).await.unwrap(), Value::Bool(true));
        }

        #[tokio::test]
        async fn should_return_false_when_value_is_below_minimum_score() {
            // Arrange / Act / Assert
            assert_eq!(evaluate("IsEligible", vec![30.into(), 50.into()]).await.unwrap(), Value::Bool(false));
        }

        #[tokio::test]
        async fn should_return_true_when_value_equals_minimum_score() {
            // Arrange / Act / Assert
            assert_eq!(evaluate("IsEligible", vec![50.into(), 50.into()]).await.unwrap(), Value::Bool(true));
        }

        #[tokio::test]
        async fn should_return_type_error_when_value_is_not_a_number() {
            // Arrange / Act / Assert
            let result = evaluate("IsEligible", vec!["fifty".into(), 50.into()]).await;
            assert!(matches!(result, Err(ForgeError::Type { .. })));
        }
    }

    mod is_valid_ni_number {
        use super::*;

        #[tokio::test]
        async fn should_return_true_for_a_valid_ni_number() {
            // Arrange / Act / Assert
            assert_eq!(evaluate("IsValidNiNumber", vec!["AB123456C".into()]).await.unwrap(), Value::Bool(true));
        }

        #[tokio::test]
        async fn should_return_true_when_spaces_are_present() {
            // Arrange / Act / Assert
            assert_eq!(evaluate("IsValidNiNumber", vec!["AB 12 34 56 C".into()]).await.unwrap(), Value::Bool(true));
        }

        #[tokio::test]
        async fn should_return_false_for_an_invalid_format() {
            // Arrange / Act / Assert
            assert_eq!(evaluate("IsValidNiNumber", vec!["12345".into()]).await.unwrap(), Value::Bool(false));
        }
    }
}
```

`call()` runs the schemas too, exactly as Forge does when it
evaluates the condition, so the tests cover the whole entry. (An
undefined value short-circuits to `false` before the closure runs.)

---

## Best practices

- **Write conditions in positive form.** Describe when the value
  *is* valid, not when it fails. The definition can always negate
  with `.not().matches()`.
- **Declare an input schema or return a type error.** The resolved
  value is an untyped `Value`. Let a schema check it, or guard it
  and return `ForgeError::type_error` so Forge can surface
  configuration errors during development.
- **Keep conditions focused on a single check.** If a condition
  tests multiple things, split it into separate conditions and let
  the definition compose them with `and(vec![])`.
- **Use meaningful names.** `IsValidNiNumber` tells the reader
  what the condition checks. `ValidateFormat` does not.
- **Accept arguments for thresholds and boundaries.** A condition
  like `is_eligible(min_score)` is reusable across different
  contexts. A condition that hardcodes a threshold is not.
- **Validate arguments early.** Use a helper function to catch
  configuration errors when the definition is built, or an
  arguments schema to catch them at request time before the
  evaluator runs.
