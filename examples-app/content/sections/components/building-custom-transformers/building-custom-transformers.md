---
title: Custom transformers
section: building-functions-and-components
path: building-functions-and-components/custom-transformers
teaches: [FunctionEntry, transformer-helpers, with_input, with_arguments, transformer-implementation]
prerequisites: [transformer, pipe, formatters, ForgePackage]
---

<p class="govuk-caption-xl">Functions</p>

# Building custom transformers

Forge ships with transformers for strings, dates, numbers, arrays,
and objects. When you need a transformation that the built-in set
does not cover, you can define your own. Custom transformers follow
the same pattern as all custom functions in Forge: you declare them
as `FunctionEntry` values and pass them to a package.

{{slot:toc}}

---

## Declaring transformers

Custom transformers are declared as `FunctionEntry::transformer`
entries. You collect the entries in a function that returns them,
and give each transformer a small helper function for use in
journey definitions:

```rust
use forge_core::authoring::transformer;
use forge_core::jsdate::{JsDate, as_date};
use forge_core::{ForgeError, FunctionEntry, Value};

pub fn my_transformers() -> Vec<FunctionEntry> {
    vec![
        // Converts a date value into a human-readable relative time string like "Today" or "3 days ago".
        FunctionEntry::transformer("RelativeTime", |value, _args| {
            let date = match value.as_str() {
                Some(s) => JsDate::parse(s),
                None => as_date(value).ok_or_else(|| ForgeError::type_error("RelativeTime expects a string or Date"))?,
            };

            let diff_ms = JsDate::now().ms - date.ms;
            let diff_days = (diff_ms / (1000.0 * 60.0 * 60.0 * 24.0)).floor();

            Ok(Value::from(match diff_days as i64 {
                0 => "Today".to_string(),
                1 => "Yesterday".to_string(),
                days => format!("{days} days ago"),
            }))
        }),
        // Shortens a string to the given length, appending the suffix if truncated.
        // args[0] - the maximum number of characters to keep.
        // args[1] - the string to append when truncation occurs.
        FunctionEntry::transformer("Truncate", |value, args| {
            let Some(value) = value.as_str() else {
                return Err(ForgeError::type_error("Truncate expects a string"));
            };

            let max_length = args[0].as_f64().unwrap_or_default() as usize;
            if value.chars().count() <= max_length {
                return Ok(Value::from(value));
            }

            Ok(Value::from(format!("{}{}", value.chars().take(max_length).collect::<String>(), args[1].to_js_string())))
        }),
    ]
}

/// Converts a date value into a human-readable relative time string.
pub fn relative_time() -> Value {
    transformer::call("RelativeTime", vec![])
}

/// Shortens a string to `max_length` characters, appending `suffix` if truncated.
pub fn truncate(max_length: impl Into<Value>, suffix: &str) -> Value {
    transformer::call("Truncate", vec![max_length.into(), suffix.into()])
}
```

Each `FunctionEntry::transformer` call takes a name and a closure
following the pattern `|value, args| -> ForgeResult<Value>`.
`transformer::call("Truncate", vec![Value::from(100), "...".into()])`
creates a transformer expression that Forge knows how to evaluate.
The helper functions are optional: `truncate(100, "...")` is just
that call with the name filled in, and gives the transformer a
typed signature and a doc comment.

Arguments passed to a transformer can be static values or expressions:

```rust
// Static arguments
answer("bio").pipe([transformer::call("Truncate", vec![Value::from(100), "...".into()])])
// Dynamic argument
answer("bio").pipe([transformer::call("Truncate", vec![data("maxBioLength").into(), "...".into()])])
```

Arguments are `Value`s, so a helper that takes `impl Into<Value>`
accepts both numbers and expressions - the built-in transformers do
the same. Forge resolves the expression before the evaluator runs.

### Services

A transformer that does not need any services is a plain closure:

```rust
FunctionEntry::transformer("RelativeTime", |value, _args| {
    // no services needed here
    Ok(value.clone())
})
```

If your transformer does need external services, take them as an
argument where you build the entries, and move them into the
closure:

```rust
pub fn my_transformers(services: Arc<Services>) -> Vec<FunctionEntry> {
    let currency_formatter = services.currency_formatter.clone();
    vec![FunctionEntry::transformer("FormatCurrency", move |value, args| {
        let Some(value) = value.as_f64() else {
            return Err(ForgeError::type_error("FormatCurrency expects a number"));
        };

        Ok(Value::from(currency_formatter.format(value, &args[0].to_js_string())))
    })]
}
```

### The closure: value and arguments

The closure receives the resolved value as its first parameter,
followed by the arguments the definition passed, as a slice.
The value is whatever the reference or previous transformer in the
pipeline resolved to. The arguments are whatever the definition
passed in, after Forge has resolved any expressions.

The value is an untyped `Value` because the resolved value depends
on what sits before the transformer in the pipeline. Verify the type
at runtime, or declare an input schema (see below) to have Forge
check it for you.

---

## Validating inputs and arguments

A `FunctionEntry` accepts `Schema`s that Forge applies before your
evaluator runs. This is the declarative alternative to manual type
checks:

- **`with_input`** validates the resolved value.
- **`with_arguments`** validates the author-supplied arguments. It
  is a `Schema::Tuple` describing each positional argument.
- **`with_output`** validates the return value.

```rust
use forge_core::schema::Schema;

FunctionEntry::transformer("Truncate", |value, args| {
    let value = value.as_str().unwrap_or_default();
    let max_length = args[0].as_f64().unwrap_or_default() as usize;
    if value.chars().count() <= max_length {
        return Ok(Value::from(value));
    }

    Ok(Value::from(format!("{}{}", value.chars().take(max_length).collect::<String>(), args[1].to_js_string())))
})
.with_input(Schema::String)
.with_arguments(Schema::Tuple(vec![
    Schema::custom("positive integer", |v| v.as_f64().is_some_and(|n| n >= 1.0 && n.fract() == 0.0)),
    Schema::String,
]))
```

With `with_input(Schema::String)` in place, a non-string value never
reaches the evaluator — Forge returns a `ForgeError::Type` instead.
That lets the closure drop the manual type guard. A failed arguments
schema also returns a `ForgeError::Type`: an author passing a zero or
negative `maxLength` is a configuration mistake, not user input.

Schemas run at request time, each time the transformer is
evaluated — not when the journey is built.

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
/// Shortens a string to `max_length` characters, appending `suffix` if truncated.
pub fn truncate(max_length: i64, suffix: &str) -> Value {
    assert!(max_length >= 1, "Truncate requires a positive integer maxLength");

    transformer::call("Truncate", vec![Value::from(max_length), suffix.into()])
}
```

A bad call fails as soon as the definition is built:

```rust
// Panics with 'Truncate requires a positive integer maxLength'.
truncate(0, "...")
```

The helper does not see services or the runtime value,
so it can only check structural properties of the arguments:
required fields, numeric ranges, enum membership, or combinations
of arguments. Checks that depend on the resolved value belong
inside the evaluator.

If an argument is itself an expression like `data("maxBioLength")`,
its resolved value is not available at author time. Validate the
resolved value inside the evaluator instead.

An arguments schema and a helper overlap: a schema validates
arguments, a helper can both validate and reshape them. They also
run at different times — the helper runs once, when the definition
is built; the arguments schema runs at request time, each time the
transformer is evaluated. Reach for an arguments schema when you
only need to check the arguments, and a helper when you need to
transform them or fail as early as possible.

---

## Type checking with ForgeError::Type

Transformer inputs are resolved at runtime, so you cannot rely on
the Rust compiler to catch type mismatches. When you have not
declared an input schema, verify the value matches what you
expect, and return `ForgeError::type_error(...)` if it does not.

```rust
FunctionEntry::transformer("Slugify", |value, _args| {
    let Some(value) = value.as_str() else {
        return Err(ForgeError::type_error("Slugify expects a string"));
    };

    let slug = value
        .to_lowercase()
        .split(|c: char| !c.is_ascii_alphanumeric())
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("-");

    Ok(Value::from(slug))
})
```

Forge treats `ForgeError::Type` differently from other errors.
Outside of validation, a type error immediately surfaces as a
configuration error so you can catch the problem during development.
Inside `validWhen`, it is caught and treated as a validation
failure. Use `ForgeError::type_error` specifically, not another
error, so Forge can distinguish type mismatches from other failures.

---

## Registration

Pass the entries to a package with `with_functions()`:

```rust
use forge_core::ForgePackage;

pub fn my_package() -> ForgePackage {
    ForgePackage::new(my_journey()).with_functions(my_transformers())
}
```

Call `with_functions()` once per group when a package mixes several
function kinds:

```rust
ForgePackage::new(my_journey())
    .with_functions(my_transformers())
    .with_functions(my_conditions())
```

Transformers that need services take them when the entries are
built:

```rust
pub fn my_package(services: Arc<Services>) -> ForgePackage {
    ForgePackage::new(my_journey()).with_functions(currency_transformers(services))
}
```

To make transformers available to every journey rather than a
single package, register the entries globally instead:

```rust
forge.register_global_functions(currency_transformers(services.clone()))?;
```

---

## Using custom transformers

Custom transformers work the same way as built-in transformers.
They can be used with `.pipe()` on references and generators, and
in the `formatters` property on fields.

### In `.pipe()`

```rust
item().path("createdAt").pipe([transformer::call("RelativeTime", vec![])])
answer("bio").pipe([transformer::call("Truncate", vec![Value::from(200), "...".into()])])
```

### In `formatters`

```rust
govuk::TEXT_INPUT.build(obj! {
    "code": "slug",
    "label": obj! { "text": "URL slug" },
    "formatters": [transformer::call("Slugify", vec![])],
})
```

### Chaining with built-in transformers

Custom and built-in transformers can be mixed freely in a pipeline.
Each one receives the output of the previous:

```rust
answer("name").pipe([transformer::string::trim(), transformer::call("Slugify", vec![]), transformer::call("Truncate", vec![Value::from(50), "".into()])])
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

    async fn evaluate(name: &str, args: Vec<Value>) -> forge_core::ForgeResult<Value> {
        let entry: FunctionEntry = my_transformers().into_iter().find(|f| &*f.name == name).unwrap();
        entry.call(args).await
    }

    mod truncate {
        use super::*;

        #[tokio::test]
        async fn should_return_the_value_unchanged_when_shorter_than_max_length() {
            // Arrange
            let value = Value::from("short");

            // Act
            let result = evaluate("Truncate", vec![value, 10.into(), "...".into()]).await.unwrap();

            // Assert
            assert_eq!(result, Value::from("short"));
        }

        #[tokio::test]
        async fn should_truncate_and_append_suffix_when_longer_than_max_length() {
            // Arrange
            let value = Value::from("a long string that should be truncated");

            // Act
            let result = evaluate("Truncate", vec![value, 10.into(), "...".into()]).await.unwrap();

            // Assert
            assert_eq!(result, Value::from("a long str..."));
        }

        #[tokio::test]
        async fn should_return_type_error_when_value_is_not_a_string() {
            // Arrange / Act / Assert
            let result = evaluate("Truncate", vec![123.into(), 10.into(), "...".into()]).await;
            assert!(matches!(result, Err(ForgeError::Type { .. })));
        }
    }
}
```

If your transformer depends on an external service, build the
entries with a stub:

```rust
struct StubFormatter;

impl CurrencyFormatter for StubFormatter {
    fn format(&self, value: f64, currency: &str) -> String {
        format!("{currency} {value:.2}")
    }
}

let services = Arc::new(Services { currency_formatter: Arc::new(StubFormatter) });
let format_currency = currency_transformers(services).remove(0);

assert_eq!(format_currency.call(vec![42.5.into(), "GBP".into()]).await?, Value::from("GBP 42.50"));
```

`call()` runs the schemas too, exactly as Forge does when it
evaluates the transformer, so the tests cover the whole entry.

---

## Best practices

- **Verify the input type.** The resolved value is an untyped
  `Value`. Declare an input schema, or check it and return
  `ForgeError::type_error` if it does not match.
- **Keep transformers pure.** A transformer should take a value and
  return a new value. If you need to read answers, set data, or
  call APIs, that is an effect, not a transformer.
- **Name transformers after what they produce, not what they
  consume.** `RelativeTime` describes the output. `ParseDateString`
  describes the input. Readers care about what comes out of the
  pipeline.
- **Use `formatters` for normalising input, `.pipe()` for shaping
  output.** Formatters run during the submission pipeline before
  validation. `.pipe()` runs at evaluation time for display and
  conditions.
- **Validate arguments early.** Use a helper function to catch
  configuration errors when the definition is built, or an
  arguments schema to catch them at request time before the
  evaluator runs.
