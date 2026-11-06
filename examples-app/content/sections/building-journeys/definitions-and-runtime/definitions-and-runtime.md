---
title: Definitions and runtime
section: building-journeys
path: building-journeys/definitions-and-runtime
teaches: [definition-time, runtime-evaluation, references-as-pointers, expression-boundary]
prerequisites: [answer, data, session, condition, transformer, generator]
---

<p class="govuk-caption-xl">Working with data</p>

# Definitions and runtime

Forge separates your journey into two distinct phases: the
definition you write at build time, and the evaluation that
happens at request time. Understanding this boundary is the key
to using references, expressions, and registered functions
correctly.

{{slot:toc}}

---

## Two phases, one journey

When your application starts, Forge reads your journey definition
and compiles it. The definition is static  - it describes what
*could* happen, not what *is* happening. No user has made a
request yet. No answers exist. No session data is loaded.

When a user hits a page, Forge evaluates the compiled definition
against live request data. References resolve to real values.
Conditions return true or false. Transformers reshape data.
Blocks become visible or hidden. This is the runtime.

```text
Application starts         User makes a request
─────────────────          ────────────────────
Definition is compiled     Definition is evaluated
Static structure           Dynamic values
"Look here later"          "Here is the value"
```

These two phases never overlap. Your definition code runs once,
at startup. Forge compiles it into optimised functions. On each
request, those pre-compiled functions receive the live context
(answers, session, data) and produce results  - the original
definition is not re-read.

---

## References are pointers

When you write `answer("fullName")`, you are not fetching the
user's answer. You are creating a pointer  - a small object that
says "when the time comes, look up the answer stored under
`fullName`."

The same applies to every reference helper:

```rust
answer("email")
// "look up the stored answer for 'email'"
data("case.status")
// "look up 'case.status' in loaded data"
session("token")
// "look up 'token' in the session"
params("id")
// "look up 'id' in the route parameters"
```

These calls return definition objects. At definition time,
there is no user, no session, and no request  - so there is no
value to return. The pointer is a promise to resolve later.

---

## Expressions compose pointers

Expressions build on references. They describe *what to do*
with a value once it exists, without doing it yet:

```rust
answer("dateOfBirth").pipe([transformer::date::format("D MMMM YYYY")])
```

This does not format a date. It creates a definition that says:
"At runtime, resolve the answer for `dateOfBirth`, then pass it
through the `Date.Format` transformer with this pattern."

The same principle applies to conditionals, formatting, and
matching:

```rust
// A description of a condition to check later
answer("age").matches(condition::number::greater_than(18))
// A description of a value to produce later
when(data("status").matches(condition::equals("ACTIVE"))).then("Active").otherwise("Inactive")
// A description of a formatted string to build later
format("%1 %2", [answer("firstName").into(), answer("lastName").into()])
```

Every one of these is a static instruction. None of them execute
until a user makes a request and Forge evaluates the step.

---

## Registered functions are the runtime

Conditions, transformers, generators, and effects are plain
functions that you write and register with Forge. When
evaluation happens, Forge calls your function and passes in
concrete values:

```rust
use forge_core::FunctionEntry;

let is_eligible = FunctionEntry::condition("IsEligible", |value, args| {
    // value is a real number here ─┘
    Ok(value.as_f64() >= args[0].as_f64())
});

let format_name = FunctionEntry::transformer("FormatName", |value, _args| {
    // value is the actual answer ─┘
    let (first, last) = (value.get("first"), value.get("last"));

    Ok(Value::from(format!("{} {}", first.to_js_string(), last.to_js_string())))
});
```

Your function body is runtime code. It runs during request
evaluation. Forge resolves references and expressions *before*
calling your function, then hands you the result as a plain
`Value`.

---

## The boundary

This is where the two phases meet. In your journey definition,
you use references and expressions to describe what Forge should
evaluate:

```rust
// Definition: tells Forge what to evaluate and which function to call
answer("score").matches(condition::call("IsEligible", vec![Value::from(18)]))
```

Inside your registered function, you work with concrete values
that Forge has already resolved:

```rust
// Runtime: the entry ties the name to the function; the resolved value arrives first, the arguments second
pub fn my_conditions() -> Vec<FunctionEntry> {
    vec![FunctionEntry::condition("IsEligible", |value, args| {
        Ok(value.as_f64() >= args[0].as_f64())
    })]
}
```

References belong in definitions. Concrete values arrive in
functions. The two sides never mix.

---

## The common mistake

Because `answer()`, `data()`, and other reference helpers are
regular Rust functions, nothing stops you from calling
them inside a registered function body:

```rust
// ✗ Wrong  - answer() inside a registered function
FunctionEntry::transformer("BuildGreeting", |_value, _args| {
    let name: Value = answer("firstName").into(); // a definition object, not a string

    Ok(Value::from(format!("Hello, {}", name.to_js_string()))) // "Hello, [object Object]"
})
```

This compiles without errors. But at runtime, `answer("firstName")`
does not look up the user's answer  - it creates and returns a
definition object (a pointer). Your function is not part of a
journey definition. It is a standalone function that Forge calls.
Forge does not inspect or process what happens inside it.

The fix is to use the values Forge passes in, or to restructure
so the reference is in the definition:

```rust
// ✓ Option 1: Use the value Forge passes to your function
FunctionEntry::transformer("BuildGreeting", |value, _args| {
    Ok(Value::from(format!("Hello, {}", value.to_js_string()))) // value is the resolved answer
})

// In the definition, pipe the reference through your transformer:
answer("firstName").pipe([transformer::call("BuildGreeting", vec![])])
```

```rust
// ✓ Option 2: Use format() in the definition itself
format("Hello, %1", [answer("firstName").into()])
```

Both options keep references in the definition layer and let the
runtime work with concrete values.

---

## Best practices

- **Keep references in definitions.** If you need a value from
  answers, session, or data inside a registered function, pipe
  the reference through the function from the definition side
  rather than calling `answer()` or `data()` inside the function
  body.
- **Wire values in through the definition.** Every function type
  receives its values from the definition layer - transformers
  through `.pipe()`, conditions through `.matches()`, generators
  through their arguments. The definition selects and resolves
  the data; the function receives it ready to use.
- **Treat function bodies as plain Rust.** Inside a
  condition, transformer, or generator, you have ordinary values.
  Use normal language features - `format!`, pattern matching,
  iterators - not Forge expressions.
- **Watch for silent failures.** Using a reference inside a
  function body does not throw an error - it returns a definition
  object that stringifies to `[object Object]`. If you see
  unexpected output, check whether a reference has leaked into
  runtime code.
