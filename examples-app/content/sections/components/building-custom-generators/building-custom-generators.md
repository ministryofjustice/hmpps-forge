---
title: Custom generators
section: building-functions-and-components
path: building-functions-and-components/custom-generators
teaches: [FunctionEntry, generator-helpers, with_arguments, generator-implementation]
prerequisites: [generator, pipe, ForgePackage]
---

<p class="govuk-caption-xl">Functions</p>

# Building custom generators

Generators produce values at runtime. The built-in generators
cover dates, but your application might need UUIDs, reference
numbers, or computed defaults. Custom generators let you define
any value-producing function and use it in your definitions the
same way you use `generator::date::today()`.

{{slot:toc}}

---

## Declaring generators

Custom generators are declared as `FunctionEntry::generator`
entries. You collect the entries in a function that returns them,
and give each generator a small helper function for use in journey
definitions:

```rust
use std::sync::atomic::{AtomicU32, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use forge_core::authoring::{Ex, generator};
use forge_core::{FunctionEntry, Value};

static SEQUENCE: AtomicU32 = AtomicU32::new(0);

pub fn my_generators() -> Vec<FunctionEntry> {
    vec![
        // Produces a new v4 UUID (with the `uuid` crate).
        FunctionEntry::generator("NewUUID", |_args| {
            Ok(Value::from(uuid::Uuid::new_v4().to_string()))
        }),
        // Produces a unique reference number with the given prefix.
        // args[0] - the string to prepend to the generated number.
        FunctionEntry::generator("NewReferenceNumber", |args| {
            let timestamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis();
            let sequence = SEQUENCE.fetch_add(1, Ordering::Relaxed) % 10_000;

            Ok(Value::from(format!("{}-{timestamp:x}-{sequence:04}", args[0].to_js_string()).to_uppercase()))
        }),
    ]
}

/// Produces a new v4 UUID.
pub fn new_uuid() -> Ex {
    generator::call("NewUUID", vec![])
}

/// Produces a unique reference number with the given prefix.
pub fn new_reference_number(prefix: impl Into<Value>) -> Ex {
    generator::call("NewReferenceNumber", vec![prefix.into()])
}
```

Each `FunctionEntry::generator` call takes a name and a closure
following the pattern `|args| -> ForgeResult<Value>`.
`generator::call("NewUUID", vec![])` creates an expression that Forge
evaluates at runtime. The helper functions are optional:
`new_uuid()` is just that call with the name filled in, and gives
the generator a typed signature and a doc comment.

As with all custom functions, arguments passed to a generator can be
static values or expressions:

```rust
"defaultValue": generator::call("NewReferenceNumber", vec!["REF".into()]),
"defaultValue": generator::call("NewReferenceNumber", vec![data("referencePrefix").into()]),
```

Arguments are `Value`s, so a helper that takes `impl Into<Value>`
accepts both strings and expressions. Forge resolves the expression
before the evaluator runs.

### How generators differ from transformers

Generators and transformers follow a similar pattern, but with one
key difference. A transformer receives a value as its first
parameter and reshapes it. A generator receives no value. It
produces something from nothing.

```rust
// Transformer: |value, args| -> result
FunctionEntry::transformer("Slugify", |value, _args| { /* ... */ })

// Generator: |args| -> result
FunctionEntry::generator("NewUUID", |_args| { /* ... */ })
```

### Services

If your generator needs external services, take them as an argument
where you build the entries, and move them into the closure:

```rust
pub fn sequence_generators(services: Arc<Services>) -> Vec<FunctionEntry> {
    let sequence_service = services.sequence_service.clone();
    vec![FunctionEntry::generator("NextSequenceNumber", move |_args| {
        Ok(Value::from(sequence_service.next()))
    })]
}
```

---

## Validating arguments

A `FunctionEntry` accepts `Schema`s that Forge applies before your
evaluator runs:

- **`with_arguments`** validates the author-supplied arguments. It
  is a `Schema::Tuple` describing each positional argument.
- **`with_output`** validates the return value.

Generators have no resolved value, so `with_input` does not apply.

```rust
use forge_core::schema::Schema;

FunctionEntry::generator("NewReferenceNumber", |args| {
    let timestamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis();
    let sequence = SEQUENCE.fetch_add(1, Ordering::Relaxed) % 10_000;

    Ok(Value::from(format!("{}-{timestamp:x}-{sequence:04}", args[0].to_js_string()).to_uppercase()))
})
.with_arguments(Schema::Tuple(vec![Schema::custom("non-empty string", |v| v.as_str().is_some_and(|s| !s.is_empty()))]))
```

The arguments schema catches an author passing an empty prefix.
A failed schema returns a `ForgeError::Type` at request time, when
the generator is evaluated — not when the journey is built.

Argument-count mismatches against a tuple schema are additionally caught at `register_package()` by semantic analysis, so a call with the wrong number of arguments fails compilation instead of waiting for request time.

---

## Author-time preparation

The helper function runs when the definition is built. Use it to
sanitise or reshape arguments before they enter the expression
tree, and to reject invalid arguments early — when the journey is
built rather than at render time.

The helper receives the same arguments as the evaluator, and
decides what goes into the built expression.

```rust
/// Produces a unique reference number with the given prefix.
pub fn new_reference_number(prefix: &str) -> Ex {
    assert!(!prefix.is_empty(), "NewReferenceNumber requires a non-empty prefix");

    generator::call("NewReferenceNumber", vec![prefix.into()])
}
```

A bad call fails as soon as the definition is built:

```rust
// Panics with 'NewReferenceNumber requires a non-empty prefix'.
new_reference_number("")
```

Since generators have no resolved first parameter, the helper sees
exactly what the author passed. Use it for structural checks
(required fields, numeric ranges, enum membership) and for
stripping properties that are not needed at runtime. Checks that
depend on services belong inside the evaluator.

If an argument is itself an expression like `data("referencePrefix")`,
its resolved value is not available at author time. Validate the
resolved value inside the evaluator instead.

---

## Chainable output

Generator expressions support `.pipe()`, `.matches()`, and
`.not().matches()`. This means you can transform and test generator
output the same way you would any other value in a definition.

### Piping

The most common use of chaining is piping a generator through
transformers:

```rust
generator::date::today().pipe([transformer::date::add_days(30), transformer::date::format("DD/MM/YYYY")])
```

Your custom generators work the same way:

```rust
generator::call("NewReferenceNumber", vec!["REF".into()]).pipe([transformer::string::to_upper_case()])
```

### Matching

You can test a generator's output with `.matches()`:

```rust
"visibleWhen": generator::call("FeatureFlag", vec!["showNewSection".into()]).matches(condition::equals(true)),
```

---

## Registration

Pass the entries to a package with `with_functions()`:

```rust
use forge_core::ForgePackage;

pub fn my_package() -> ForgePackage {
    ForgePackage::new(my_journey()).with_functions(my_generators())
}
```

Call `with_functions()` once per group when a package mixes several
function kinds:

```rust
ForgePackage::new(my_journey())
    .with_functions(my_generators())
    .with_functions(my_transformers())
```

Generators that need services take them when the entries are built:

```rust
pub fn my_package(services: Arc<Services>) -> ForgePackage {
    ForgePackage::new(my_journey()).with_functions(sequence_generators(services))
}
```

To make generators available to every journey rather than a single
package, register the entries globally instead:

```rust
forge.register_global_functions(sequence_generators(services.clone()))?;
```

---

## Using custom generators

Custom generators can appear anywhere a dynamic value is accepted:
block properties, field defaults, `format()` arguments, and more.

### Default values

```rust
govuk::TEXT_INPUT.build(obj! {
    "code": "referenceId",
    "label": obj! { "text": "Reference number" },
    "defaultValue": generator::call("NewReferenceNumber", vec!["REF".into()]),
})
```

### In Format

```rust
govuk::BODY.build(obj! {
    "text": format("Your reference is %1.", [generator::call("NewReferenceNumber", vec!["APP".into()]).into()]),
})
```

### In block properties

```rust
govuk::INSET_TEXT.build(obj! {
    "text": generator::call("DisclaimerText", vec!["en".into()]),
})
```

---

## Generators vs effects

Generators and effects can both produce values at runtime, but they
serve different purposes.

Use a **generator** when the value can be produced without side
effects. UUIDs, timestamps, computed defaults, and formatted
strings are all good candidates. Generators are pure functions.
They do not read answers, set data, or call APIs.

Use an **effect** when producing the value requires interacting
with external systems or the request context. Loading data from an
API, reading session state, or computing a value from multiple
answers are effect territory. Effects have access to the full
context object; generators do not.

If you find yourself wishing a generator could read an answer or
call an API, it should be an effect with `context.set_data()`
instead.

---

## Testing

A `FunctionEntry` can be evaluated directly with `call()`, which
takes the generator's arguments. Find the entry by name and call it
from an async test; build entries that need services with stubs:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use forge_core::{FunctionEntry, Value};

    fn generator(name: &str) -> FunctionEntry {
        my_generators().into_iter().find(|f| &*f.name == name).unwrap()
    }

    mod new_reference_number {
        use super::*;

        #[tokio::test]
        async fn should_start_with_the_given_prefix() {
            // Arrange / Act
            let result = generator("NewReferenceNumber").call(vec!["REF".into()]).await.unwrap();

            // Assert
            assert!(result.to_js_string().starts_with("REF-"));
        }
    }

    mod next_sequence_number {
        use super::*;
        use std::sync::atomic::{AtomicUsize, Ordering};

        struct StubSequence(AtomicUsize);

        impl SequenceService for StubSequence {
            fn next(&self) -> f64 {
                self.0.fetch_add(1, Ordering::Relaxed);
                42.0
            }
        }

        #[tokio::test]
        async fn should_call_the_sequence_service() {
            // Arrange
            let sequence = Arc::new(StubSequence(AtomicUsize::new(0)));
            let services = Arc::new(Services { sequence_service: sequence.clone() });
            let next_sequence_number = sequence_generators(services).remove(0);

            // Act
            let result = next_sequence_number.call(vec![]).await.unwrap();

            // Assert
            assert_eq!(result, Value::from(42));
            assert_eq!(sequence.0.load(Ordering::Relaxed), 1);
        }
    }
}
```

`call()` runs the schemas too, exactly as Forge does when it
evaluates the generator, so the tests cover the whole entry.

---

## Best practices

- **Keep generators pure.** A generator should produce a value
  without side effects. If it needs to read answers, set data, or
  interact with external services beyond simple value production,
  use an effect instead.
- **Use generators for values that belong inline.** Default values,
  computed properties, and formatted strings are good fits.
  Reference data that multiple blocks need is better loaded by an
  effect into `data()`.
- **Return consistent types.** A generator that sometimes returns a
  string and sometimes returns a number makes pipeline chaining
  unpredictable. Pick a return type and stick with it.
- **Validate arguments early.** Use a helper function to catch
  configuration errors when the definition is built, or an
  arguments schema to catch them at request time before the
  evaluator runs.
