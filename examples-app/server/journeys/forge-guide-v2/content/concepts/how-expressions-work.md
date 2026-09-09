---
title: How expressions work
slug: how-expressions-work
section: concepts
path: concepts/how-expressions-work
nav: Answers and request state
order: 10
description:
  How Forge expressions describe values declaratively, from references and conditions
  to transformers, pipelines, and the boundary that keeps definitions predictable
teaches:
  [
    expressions,
    references,
    conditions,
    predicates,
    transformers,
    generators,
    pipelines,
    scopes,
    request-state,
    item,
    loop,
  ]
prerequisites: [how-forge-runs-a-request, how-answers-work]
related:
  concept:
    [
      working-with-repeated-data,
      how-validation-works,
      how-blocks-resolution-and-rendering-connect,
    ]
  reference: [session, generator]
---

# How expressions work

Expressions are how journey definitions stay declarative while still reacting to the
current request.

A journey definition describes the stable shape of a flow. Some values within that
definition depend on the request: the current answer state, loaded data, route params,
query parameters, submitted form data, session data, headers, cookies, or the current
iterator item. Expressions describe those values. Forge resolves them at runtime, so the
definition doesn't need to become procedural code.

## Expressions describe values

An expression is declarative data, not executable code. It describes what value Forge
needs and where it comes from. Forge compiles that description into an internal function
at startup and runs it at the right moment during the request.

```ts
Answer("emailAddress");
Data("profile.fullName").pipe(Transformer.String.Trim());
Answer("contactMethod").match(Condition.Equals("email"));
Format("Email address for %1", Data("person.fullName"));
```

These four expressions show different kinds of value. The first two read from request
state, one with a trim transformer piped onto it. The third produces a boolean by testing
an answer against a condition. The fourth builds a string from a template and a data
reference.

None of these lines do work. They don't save data, call services, or change state. They
describe values, and Forge resolves them when it needs them.

## The expression family

Expressions come in several kinds, each with a different job. The reference pages cover
their APIs in detail. What matters here is the family as a whole and the ideas that cut
across all of them.

**References** read from request state. `Answer`, `Data`, `Params`, `Query`, `Post`,
`Session`, `Request.Headers`, and `Request.Cookies` each name a different part. References
can reach nested values with dot paths, and a missing intermediate value resolves to absent
rather than failing.

**Conditions** test a value against a rule. `.match()` joins a reference and a condition
into a predicate: a true-or-false value Forge can use for a decision. `and`, `or`, `xor`,
and `not` combine predicates when a decision depends on more than one test.

**Transformers** reshape values. `.pipe()` threads a value through one or more transformers
in sequence, where each step's output becomes the next step's input.

**Generators** create values that have no single source. `Format`, for example, builds a
string from a template and expression arguments.

**Scoped references** read values that only exist inside a particular context. `Self()`
reads the current field's answer inside validation, `Item()` reads the current item inside
an iterator, and `Loop` reads the current loop state.

### The property gives an expression its meaning

The expression itself only produces a value. The property it sits on decides what that
value means. The same condition can hide a field, gate a validation rule, control
reachability, or guard a submit hook, depending on which property reads the result:

```ts
visibleWhen: Answer("contactMethod").match(Condition.Equals("email"));
```

```ts
validation({
  condition: Self().match(Condition.IsRequired()),
  message: "Enter an email address",
});
```

The condition doesn't change. What changes is which property reads it and what that
property does with a true or false answer.

### Absent values propagate cleanly

When a reference points to a missing value, the expression resolves to absent. That
absence flows through pipelines (each step skips `undefined` independently), makes
conditions false, leaves labels blank, or lets a default take over, depending on where the
expression is used. Expressions don't need guard logic for missing values because absence
is a first-class result.

### Scoped references are validated at startup

Forge rejects a `Self()` reference used outside a field block, or an `Item()` reference
used outside an iterator, before any request runs. A scoped reference outside its context
is a definition error, not a runtime surprise.

## When an expression runs

An expression is resolved when Forge needs its value. The property the expression sits on
determines the timing: `defaultValue` resolves during answer preparation on a `GET`,
conditions during validation, submit predicates when Forge handles a submission, and block
labels when Forge prepares the render context.

This timing matters because request state changes through the request. Access hooks run
before answer preparation, so expressions in access read the state available at that
point. Submit hooks run after submitted answers are prepared, so submit behaviour can
read the user's latest prepared answers.

:::note
---
---
Request-scoped references (`Post()`, `Query()`, `Params()`, `Request.*`) read values from
the current request. During reachability, Forge evaluates validation across steps that
weren't part of that request, so these values can be absent or different. The
`submissionOnly` flag limits a validation rule to the current request's step, skipping it
during reachability.
:::

:::deep-dive
---
title: How phase context limits expression state
description: Forge compiles expressions into phase-specific functions. Each phase receives a context snapshot with only the state that phase needs.
summary: Show how phases limit expression context
---

Forge compiles expressions into JavaScript functions at startup. Each function receives a
context snapshot scoped to the phase it runs in.

The base context carries answers, data, session, params, and query. Phase-specific
contexts extend it. The answer preparation and resolve contexts add `post` (submitted form
data).

The phase order is fixed: context preparation, access, answer preparation, validation,
reachability, answer cleardown, then either entry validation (GET) or submit hooks (POST),
then route tree and resolve. Each phase gives the next one a more settled view of the
request. The part of the request that owns a decision is the part whose state the
expression reads.
:::

## Expressions describe values, never work

An expression can be resolved more than once during a request, in traces, or while
rendering nested blocks. It gives the same answer for the same request state. That
repeated resolution is safe because expressions are pure: they read, test, format, choose,
map, filter, and transform, but they don't change anything.

Side effects belong in hooks, not in expressions. Forge enforces this boundary at startup:
effects are a distinct function type, and Forge rejects an effect used outside a hook
before any request runs.

That boundary is what keeps Forge definitions predictable. A reader can look at a label
expression and know it only creates a label, read a condition without wondering whether
it saved a record, and read a transformer without wondering whether it called an API.
The place to look for side effects is a hook.
