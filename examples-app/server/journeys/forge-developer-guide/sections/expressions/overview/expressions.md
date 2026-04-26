---
title: Authoring language
section: authoring-language
path: authoring-language
teaches: [expressions, evaluation, dynamic-properties, references, functions]
prerequisites: [block, field, step, journey]
---

<p class="govuk-caption-xl">Authoring language</p>

# Authoring language
Journey definitions in Forge are declarative. You describe what
your pages look like, what fields they contain, and how users move
through them. But definitions can also be dynamic: a label that
changes based on a previous answer, a field that appears when a
radio is selected, an effect that loads data from an API. This
section covers the tools that make that possible.

{{slot:toc}}

---

## How it fits together

At the core of Forge's authoring language are three ideas:

**References** look up values. `Answer('email')` gets a field
answer. `Data('countries')` gets step data. `Params('caseId')` gets
a route parameter. References are the inputs to everything else.

**Expressions** compose and transform those values. `Format()`
builds strings. `when().then().else()` branches on conditions.
`.pipe()` transforms values through a pipeline. `.each()` iterates
over collections.

**Functions** are pluggable operations that extend what definitions
can do. Conditions test values. Transformers reshape them.
Generators produce new values at runtime. Effects run server-side
logic like API calls and data persistence.

These three layers work together. A field might reference an
answer, pipe it through a transformer, and test it with a
condition, all in a single validation rule:

```typescript
validation({
  condition: Self()
    .pipe(Transformer.String.Trim())
    .match(Condition.IsRequired()),
  message: 'Enter your name',
})
```

Forge evaluates all of this before the component sees it. The
component receives plain values, never expressions.

---

## What this section covers

### References

References look up values from different sources in the current
request.

- [Answer and Self](answer-and-self) - field answers
- [Data](data) - step and journey data
- [Params](params) - URL route parameters
- [Query](query) - query string parameters
- [Post](post) - form submission values
- [Session](session) - server-side session
- [Request](request) - request metadata
- [Item (Iterators)](item) - current item in an iteration
- [Loop (Iterators)](loop) - metadata about the current iteration

### Expressions

Expressions build, compose, and branch on values.

- [Format](format) - string interpolation with placeholders
- [Literal](literal) - wrapping static values for chaining
- [Iterators](iterators) - transforming, filtering, and searching
  collections
- [Combinators](combinators) - composing conditions with `and`,
  `or`, `not`, `xor`
- [Conditionals](conditionals) - branching on conditions to produce
  values

### Functions

Functions are pluggable, injectable operations registered in
packages.

- [Generators](generators) - producing values at runtime
- [Transformers](transformers) - converting values between forms
- [Conditions](conditions) - testing values and returning booleans
- [Effects](effects) - side-effecting logic for loading, saving,
  and integrating
