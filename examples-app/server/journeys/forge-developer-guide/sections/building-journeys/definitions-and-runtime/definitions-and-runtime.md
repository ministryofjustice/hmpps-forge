---
title: Definitions and runtime
section: building-journeys
path: building-journeys/definitions-and-runtime
teaches: [definition-time, runtime-evaluation, references-as-pointers, expression-boundary]
prerequisites: [Answer, Data, Session, Condition, Transformer, Generator]
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

When you write `Answer('fullName')`, you are not fetching the
user's answer. You are creating a pointer  - a small object that
says "when the time comes, look up the answer stored under
`fullName`."

The same applies to every reference helper:

```typescript
Answer('email')       // "look up the stored answer for 'email'"
Data('case.status')   // "look up 'case.status' in loaded data"
Session('token')      // "look up 'token' in the session"
Params('id')          // "look up 'id' in the route parameters"
```

These calls return definition objects. At definition time,
there is no user, no session, and no request  - so there is no
value to return. The pointer is a promise to resolve later.

---

## Expressions compose pointers

Expressions build on references. They describe *what to do*
with a value once it exists, without doing it yet:

```typescript
Answer('dateOfBirth').pipe(Transformer.Date.Format('D MMMM YYYY'))
```

This does not format a date. It creates a definition that says:
"At runtime, resolve the answer for `dateOfBirth`, then pass it
through the `Date.Format` transformer with this pattern."

The same principle applies to conditionals, formatting, and
matching:

```typescript
// A description of a condition to check later
Answer('age').match(Condition.Number.GreaterThan(18))

// A description of a value to produce later
when(Data('status').match(Condition.Equals('ACTIVE')))
  .then('Active')
  .else('Inactive')

// A description of a formatted string to build later
Format('%1 %2', Answer('firstName'), Answer('lastName'))
```

Every one of these is a static instruction. None of them execute
until a user makes a request and Forge evaluates the step.

---

## Registered functions are the runtime

Conditions, transformers, generators, and effects are plain
functions that you write and register with Forge. When
evaluation happens, Forge calls your function and passes in
concrete values:

```typescript
import { ConditionRegistry, TransformerRegistry } from '@ministryofjustice/hmpps-forge/core/authoring'

const conditions = new ConditionRegistry()
const transformers = new TransformerRegistry()

const IsEligible = conditions.register('IsEligible', () => (value: unknown, minAge: number) => {
  // value is a real number here ─┘
  return (value as number) >= minAge
})

const FormatName = transformers.register('FormatName', () => (value: unknown) => {
  // value is the actual answer ─┘
  const { first, last } = value as Name

  return `${first} ${last}`
})
```

Your function body is runtime code. It runs during request
evaluation. Forge resolves references and expressions *before*
calling your function, then hands you the result as a plain
JavaScript value.

---

## The boundary

This is where the two phases meet. In your journey definition,
you use references and expressions to describe what Forge should
evaluate:

```typescript
// Definition: tells Forge what to evaluate and which function to call
Answer('score').match(MyConditions.IsEligible(18))
```

Inside your registered function, you work with concrete values
that Forge has already resolved:

```typescript
// Runtime: register() ties the name to the function; deps arrive first, the resolved value second
export const MyConditions = {
  IsEligible: conditions.register('IsEligible', () => (value: unknown, minAge: number) => {
    return (value as number) >= minAge
  }),
}
```

References belong in definitions. Concrete values arrive in
functions. The two sides never mix.

---

## The common mistake

Because `Answer()`, `Data()`, and other reference helpers are
regular TypeScript functions, nothing stops you from calling
them inside a registered function body:

```typescript
// ✗ Wrong  - Answer() inside a registered function
transformers.register('BuildGreeting', () => (value: unknown) => {
  const name = Answer('firstName')  // returns a definition object, not a string

  return `Hello, ${name}`           // "Hello, [object Object]"
})
```

This compiles without errors. But at runtime, `Answer('firstName')`
does not look up the user's answer  - it creates and returns a
definition object (a pointer). Your function is not part of a
journey definition. It is a standalone function that Forge calls.
Forge does not inspect or process what happens inside it.

The fix is to use the values Forge passes in, or to restructure
so the reference is in the definition:

```typescript
// ✓ Option 1: Use the value Forge passes to your function
const BuildGreeting = transformers.register('BuildGreeting', () => (value: unknown) => {
  return `Hello, ${value}`  // value is the resolved answer
})

// In the definition, pipe the reference through your transformer:
Answer('firstName').pipe(BuildGreeting())
```

```typescript
// ✓ Option 2: Use Format() in the definition itself
Format('Hello, %1', Answer('firstName'))
```

Both options keep references in the definition layer and let the
runtime work with concrete values.

---

## Best practices

- **Keep references in definitions.** If you need a value from
  answers, session, or data inside a registered function, pipe
  the reference through the function from the definition side
  rather than calling `Answer()` or `Data()` inside the function
  body.
- **Wire values in through the definition.** Every function type
  receives its values from the definition layer - transformers
  through `.pipe()`, conditions through `.match()`, generators
  through their arguments. The definition selects and resolves
  the data; the function receives it ready to use.
- **Treat function bodies as plain TypeScript.** Inside a
  condition, transformer, or generator, you have ordinary values.
  Use normal language features - string interpolation, object
  destructuring, array methods - not Forge expressions.
- **Watch for silent failures.** Using a reference inside a
  function body does not throw an error - it returns a definition
  object that stringifies to `[object Object]`. If you see
  unexpected output, check whether a reference has leaked into
  runtime code.
