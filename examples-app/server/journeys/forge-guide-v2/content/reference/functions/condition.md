---
title: condition()
slug: condition
section: reference
path: reference/condition
nav: Authoring API/Functions
order: 30
description: Defines a function that tests a value and returns true or false
teaches: [condition, inputSchema, argumentsSchema, factory, dependencies, built-in-conditions]
prerequisites: []
related:
  concept: how-validation-works, how-expressions-work
  how-to: creating-your-own-custom-condition
  reference: validation, match
---

# `condition()`

`condition()` defines a function that tests a value against a rule. You use conditions with `.match()` to check answers, control visibility, branch journeys, and validate fields.

```typescript
import { condition } from '@ministryofjustice/hmpps-forge/core/authoring'

const IsValidMembershipNumber = condition('Library.IsValidMembershipNumber', {
  inputSchema: z.string(),
  factory: () => (value: string) => /^LIB-\d{6}$/.test(value),
})

// In a journey definition:
Self().match(IsValidMembershipNumber())
```

---

## Reference

### `condition(name, options)`

Creates a named condition. When you use it in a journey definition, it registers itself automatically - no registry or `functions` listing needed.

```typescript
function condition(name: string, options: ConditionOptions): ConditionEntry
```

You can also omit the name to create an anonymous condition:

```typescript
function condition(options: ConditionOptions): ConditionEntry
```

#### Options

:::param
---
name: factory
type: "(deps) => (value, ...args) => boolean | Promise\<boolean>"
required: true
---
A function that builds the evaluator. The outer function receives your application's
dependencies (or an empty object when there are none). The inner function receives the
value under test, followed by any authored arguments, and returns `true` or `false`.

- **`deps`** - your application's dependencies, such as an API client or a service.
- **`value`** - the value being tested. This is whatever `.match()` is called on:
  the current field value for [`Self()`](./self), a loaded value for [`Data('case.status')`](./data), and
  so on.
- **`...args`** - the arguments authored at the call site. `IsValidCrn(5)` passes `5`
  as the first argument. Each argument also accepts an expression, so
  `IsValidCrn(Answer('minimumLength'))` works too.

The factory runs during context preparation for each request. It receives the merged
package, adapter, and request dependencies. Duplicate keys across these sources cause an
error. The returned evaluator is called each time the condition is tested during a request.
:::

:::param
---
name: inputSchema
type: ZodType
required: false
---
Validates the value under test before the evaluator runs. When the value doesn't match
the schema, the condition returns `false` without calling your function. This lets you
receive a typed value and skip the shape-checking yourself.

[See describing the value your condition accepts.](#describe-the-value-your-condition-accepts)
:::

:::param
---
name: argumentsSchema
type: ZodType
required: false
---
Validates the authored arguments at runtime. A failing argument is an authoring mistake,
so it throws rather than returning `false`. Also drives arity checking at compilation.

[See adding configuration with arguments.](#add-configuration-with-arguments)
:::

:::param
---
name: outputSchema
type: ZodType
required: false
---
Validates the evaluator's return value. Defaults to a boolean schema when omitted.
Schema validation checks the result without replacing it with parsed output.
:::

:::param
---
name: prepare
type: "(...args) => unknown[]"
required: false
---
Transforms the authored arguments before they are embedded in the expression. It runs
once at definition time (when the module loads), not on every request. Use it to
validate arguments early or to reshape them into a different form for the evaluator.

When present, its parameter types become the entry's call signature instead of the
evaluator's trailing parameters. This lets you offer one API at the call site and pass
something different to the evaluator.

[See reshaping arguments with prepare.](#reshape-arguments-with-prepare)
:::

#### Returns

A `ConditionEntry` - a function you call with arguments to produce a condition
expression. The expression works with `.match()`, `when`, and anywhere else a condition
is accepted.

The entry also carries the function's metadata (`name`, schemas,
`factory`). When you use it in a journey definition, it registers itself - you don't
need to add it to a registry or a `functions` array.

#### Caveats

- Schemas validate values without transforming them. Evaluators receive the original
  input and arguments, and their original return value is preserved.

- A `null` or `undefined` value always short-circuits to `false` without calling the evaluator,
  even when no `inputSchema` is set. You cannot write a condition that tests for absence
  \- use `not(Condition.IsRequired())` instead.

- The evaluator must return a `boolean`. Truthy values throw a `TypeError` at request
  time.

- An evaluator that throws fails the request, including inside `validWhen`. Use
  `inputSchema` to return `false` for an unsupported input shape.

- The evaluator runs on every test. The same condition used in `validWhen`,
  `dependentWhen`, branching, and reachability runs separately for each. A condition
  backed by a service call can hit that service several times per request.

---

## Usage

### Create a condition that tests a value

The simplest condition takes a value and returns `true` or `false`:

```typescript
const IsValidMembershipNumber = condition('Library.IsValidMembershipNumber', {
  factory: () => (value: unknown) => {
    return typeof value === 'string' && /^LIB-\d{6}$/.test(value)
  },
})
```

Use it in a field's [validation](./validation) with `.match()`:

```typescript
validWhen: [
  validation({
    condition: Self().match(IsValidMembershipNumber()),
    message: 'Enter a membership number in the format LIB-123456',
  }),
]
```

`Self()` refers to the current field value. When `.match()` runs, that value is passed
into the condition as `value`.

### Describe the value your condition accepts

Adding an `inputSchema` lets you skip the type-checking and focus on the rule itself:

```typescript
const IsValidMembershipNumber = condition('Library.IsValidMembershipNumber', {
  inputSchema: z.string(),
  factory: () => (value: string) => /^LIB-\d{6}$/.test(value),
})
```

When the value isn't a string, the condition returns `false` before your function runs.
Your function can now receive a `string` directly and concentrate on the interesting
part of the check.

### Add configuration with arguments

When the same rule applies to several cases with different parameters, add arguments
instead of creating separate conditions:

```typescript
type MembershipType = 'standard' | 'archive'

const membershipNumberPatterns: Record<MembershipType, RegExp> = {
  standard: /^LIB-\d{6}$/,
  archive: /^ARCH-\d{4}$/,
}

const IsValidMembershipNumber = condition('Library.IsValidMembershipNumber', {
  inputSchema: z.string(),
  argumentsSchema: z.tuple([z.enum(['standard', 'archive'])]),
  factory: () => (value: string, membershipType: MembershipType) => {
    return membershipNumberPatterns[membershipType].test(value)
  },
})
```

Choose the membership type at the call site:

```typescript
Self().match(IsValidMembershipNumber('standard'))
```

The field supplies the value through `.match()`. The `'standard'` argument is authored
in the definition and arrives as `membershipType`. If the definition passes a value the
`argumentsSchema` doesn't accept, an error is reported instead of running the condition
with configuration it doesn't understand.

Arguments also accept expressions, so you can pass a resolved value:

```typescript
Self().match(IsValidMembershipNumber(Data('membershipType')))
```

### Use an application dependency

When a condition needs to call a service - checking whether a membership number is
still active, for example - type the factory's `deps` parameter:

```typescript
const IsValidMembershipNumber = condition('Library.IsValidMembershipNumber', {
  inputSchema: z.string(),
  argumentsSchema: z.tuple([z.enum(['standard', 'archive'])]),
  factory: (deps: { membershipService: MembershipService }) =>
    async (value: string, membershipType: MembershipType) => {
      if (!membershipNumberPatterns[membershipType].test(value)) {
        return false
      }

      return deps.membershipService.isValid(value, membershipType)
    },
})
```

The dependency is supplied when the application registers the package:

```typescript
forge.registerPackage(libraryPackage, {
  membershipService: services.membershipService,
})
```

The format check still runs first. A malformed number returns `false` immediately; only
a well-formed number calls the service.

### Return an asynchronous result

When the evaluator calls an asynchronous service, return a promise. Evaluation waits
for it before deciding whether the condition passed:

```typescript
factory: (deps: { membershipService: MembershipService }) =>
  async (value: string) => {
    return deps.membershipService.isValid(value)
  },
```

Synchronous conditions don't need to return a promise - a plain `boolean` works.

### Reshape arguments with prepare

Sometimes the API you want at the call site is different from what the evaluator needs.
`prepare` bridges that gap. It runs once when the module loads, receives the authored
arguments, and returns a new array that replaces them in the expression.

In this example, the author picks a membership type by name. `prepare` looks up the
matching pattern and passes the `RegExp` to the evaluator instead:

```typescript
const IsValidMembershipNumber = condition('Library.IsValidMembershipNumber', {
  inputSchema: z.string(),
  prepare: (membershipType: MembershipType) => {
    const pattern = membershipNumberPatterns[membershipType]
    if (!pattern) {
      throw new Error(`Unknown membership type: "${membershipType}"`)
    }
    return [pattern]
  },
  factory: () => (value: string, pattern: RegExp) => pattern.test(value),
})
```

The call site stays simple:

```typescript
Self().match(IsValidMembershipNumber('standard'))
```

The author writes `'standard'`, and `prepare` resolves it to the right `RegExp`. The
evaluator never needs to know about the lookup. If the author passes an unknown type,
`prepare` throws immediately at definition time rather than failing silently during a
request.

`prepare` does not receive dependencies or the runtime value. It only sees the arguments
from the call site. For request-time validation, use `argumentsSchema` instead.

---

## Built-in conditions

The `Condition` namespace provides ready-made conditions for common checks. They all
work with `.match()` and `when` just like custom conditions.

```typescript
import { Condition } from '@ministryofjustice/hmpps-forge/core/authoring'

Self().match(Condition.IsRequired())
Answer('email').match(Condition.Email.IsValidEmail())
Answer('age').match(Condition.Number.Between(18, 65))
```

### General

| Condition | Tests |
|---|---|
| `Condition.IsRequired()` | Value is not null, undefined, empty string, or empty array |
| `Condition.Equals(expected)` | Value is strictly equal to `expected` |

### String

| Condition | Tests |
|---|---|
| `Condition.String.MatchesRegex(pattern)` | Value matches the regex pattern |
| `Condition.String.HasMinLength(min)` | String has at least `min` characters |
| `Condition.String.HasMaxLength(max)` | String has at most `max` characters |
| `Condition.String.HasExactLength(length)` | String has exactly `length` characters |
| `Condition.String.HasMaxWords(max)` | String contains at most `max` words |
| `Condition.String.LettersOnly()` | String contains only letters |
| `Condition.String.DigitsOnly()` | String contains only digits |
| `Condition.String.LettersAndDigitsOnly()` | String contains only letters and digits |
| `Condition.String.LettersWithCommonPunctuation()` | String contains letters and common punctuation |
| `Condition.String.LettersWithSpaceDashApostrophe()` | String contains letters, spaces, dashes, and apostrophes |
| `Condition.String.AlphanumericWithCommonPunctuation()` | String contains alphanumeric characters and common punctuation |
| `Condition.String.AlphanumericWithAllSafeSymbols()` | String contains alphanumeric characters and safe symbols |
| `Condition.String.StartsWith(prefix)` | String starts with `prefix` |
| `Condition.String.EndsWith(suffix)` | String ends with `suffix` |
| `Condition.String.Contains(substring)` | String contains `substring` |

### Number

| Condition | Tests |
|---|---|
| `Condition.Number.IsNumber()` | Value is a number |
| `Condition.Number.IsInteger()` | Value is an integer |
| `Condition.Number.GreaterThan(n)` | Value is greater than `n` |
| `Condition.Number.GreaterThanOrEqual(n)` | Value is greater than or equal to `n` |
| `Condition.Number.LessThan(n)` | Value is less than `n` |
| `Condition.Number.LessThanOrEqual(n)` | Value is less than or equal to `n` |
| `Condition.Number.Between(min, max)` | Value is between `min` and `max` inclusive |

### Date

| Condition | Tests |
|---|---|
| `Condition.Date.IsValid()` | Value is a valid date |
| `Condition.Date.IsValidYear()` | Value is a valid year |
| `Condition.Date.IsValidMonth()` | Value is a valid month |
| `Condition.Date.IsValidDay()` | Value is a valid day |
| `Condition.Date.IsBefore(date)` | Date is before `date` |
| `Condition.Date.IsAfter(date)` | Date is after `date` |
| `Condition.Date.IsFutureDate()` | Date is in the future |
| `Condition.Date.IsPastDate()` | Date is in the past |
| `Condition.Date.IsToday()` | Date is today |

### Email

| Condition | Tests |
|---|---|
| `Condition.Email.IsValidEmail()` | Value is a valid email address |

### Phone

| Condition | Tests |
|---|---|
| `Condition.Phone.IsValidPhoneNumber()` | Value is a valid phone number |
| `Condition.Phone.IsValidUKMobile()` | Value is a valid UK mobile number |

### Address

| Condition | Tests |
|---|---|
| `Condition.Address.IsValidPostcode()` | Value is a valid postcode |

### Array

| Condition | Tests |
|---|---|
| `Condition.Array.IsArray()` | Value is an array |
| `Condition.Array.IsIn(expected)` | Value is in the `expected` array |
| `Condition.Array.Contains(expected)` | Array contains `expected` |
| `Condition.Array.ContainsAny(expected)` | Array contains any item in `expected` |
| `Condition.Array.ContainsAll(expected)` | Array contains every item in `expected` |

### Object

| Condition | Tests |
|---|---|
| `Condition.Object.IsObject()` | Value is an object |
| `Condition.Object.HasProperty(path)` | Object has a property at `path` |
| `Condition.Object.PropertyIsEmpty(path)` | Property at `path` is empty |
| `Condition.Object.PropertyHasValue(path)` | Property at `path` has a value |

---

## Troubleshooting

### The condition always returns `false`

If you added an `inputSchema`, the value might not match it. When the schema fails, the
condition returns `false` before your function runs. Check that the value reaching
`.match()` has the shape your schema expects - for example, a field value that hasn't
been submitted yet might be `undefined` rather than a string.

### An argument error is thrown instead of the condition running

The `argumentsSchema` failed. This means the definition passed a value the schema
doesn't accept - for example, `'premium'` when the schema only allows `'standard'` or
`'archive'`. Fix the value at the call site.

### The condition doesn't register

Make sure the condition is actually used in a journey definition. The entry registers
itself when it appears in a `.match()`, `when`, or similar expression inside a
registered package. Defining the condition alone doesn't register it - it needs to be
part of a journey.
