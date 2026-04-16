---
title: Generators
section: authoring-language
path: authoring-language/generators
teaches: [Generator, Generator.Date.Now, Generator.Date.Today, defineGeneratorFunctions, custom-generators]
prerequisites: [pipe, Transformer]
---

<p class="govuk-caption-xl">Functions</p>

# Generators

Generators produce values at runtime. Where references look up
existing data, generators create new values each time they are
evaluated. Forge ships with date generators, and you can define
your own.

{{slot:toc}}

---

## What is a generator?

A generator is a function expression that produces a value when
Forge evaluates it. The most common use is getting the current date
for date constraints and display, but generators can produce any
value: timestamps, identifiers, computed defaults.

```typescript
import { Generator } from '@ministryofjustice/hmpps-forge/core/authoring'

Generator.Date.Today()
```

Because generators produce values at evaluation time, the result
can change between requests. A date picker's `minDate` set to
`Generator.Date.Today()` always reflects today, not the day the
journey was defined.

---

## Using in your definitions

Generators can appear anywhere a dynamic value is accepted:
block properties, field defaults, `Format()` arguments, conditions,
and more. They work the same way as references, except they produce
a fresh value each time rather than looking one up.

A date picker that only allows appointments in the next 30 days:

```typescript
MOJDatePicker({
  code: 'appointmentDate',
  label: { text: 'Appointment date' },
  minDate: Generator.Date.Today().pipe(
    Transformer.Date.Format('DD/MM/YYYY'),
  ),
  maxDate: Generator.Date.Today().pipe(
    Transformer.Date.AddDays(30),
    Transformer.Date.Format('DD/MM/YYYY'),
  ),
})
```

A default value that is computed fresh on each render:

```typescript
GovUKTextInput({
  code: 'referenceId',
  defaultValue: MyGenerators.NewReferenceId(),
})
```

Display text that includes a generated value:

```typescript
GovUKBody({
  text: Format(
    'Your target date is %1.',
    Generator.Date.Today().pipe(
      Transformer.Date.AddMonths(3),
      Transformer.Date.ToUKLongDate(),
    ),
  ),
})
```

---

## Custom generators

You can define your own generators using `defineGeneratorFunctions`.
A custom generator is referenced in the journey definition and
implemented in the package, following the same pattern as effects,
conditions, and transformers.

```typescript
import {
  defineGeneratorFunctions,
  GeneratorFunctionExpr,
} from '@ministryofjustice/hmpps-forge/core/authoring'

export interface MyGeneratorShape {
  NewUUID: () => GeneratorFunctionExpr
}

export const { generators: MyGenerators, implementations: myGeneratorImplementations } =
  defineGeneratorFunctions<MyGeneratorShape, MyDeps>({
    NewUUID: (deps) => () => {
      return crypto.randomUUID()
    },
  })
```

Like all custom functions in Forge, generators follow the
`(deps) => (...args) => result` pattern. The outer function
receives injected dependencies, even if the generator does not need
them. Dependencies are injected when you register the package with
`forge.registerPackage(pkg, deps)`.

Use it in a definition:

```typescript
GovUKTextInput({
  code: 'referenceId',
  defaultValue: MyGenerators.NewUUID(),
})
```

Register the implementations in the package:

```typescript
export default createForgePackage({
  journey: myJourney,
  functions: {
    ...myGeneratorImplementations,
  },
})
```

---

## API surface

### `defineGeneratorFunctions(implementations)`

Defines custom generator functions. Returns a `generators` object
for use in definitions and an `implementations` object for
registration in a package.

```typescript
import { defineGeneratorFunctions } from '@ministryofjustice/hmpps-forge/core/authoring'
```

Generator functions return a chainable expression that supports
`.path()`, `.match()`, `.pipe()`, and `.each()`.

---

## Best practices

- **Use generators for pure value production.** If the value
  depends on external state like an API, session, or database, an
  effect with `context.setData()` is a better fit. Generators are
  for values that can be produced without side effects.
- **Pipe generators to shape the output.** A generator produces a
  raw value. Use `.pipe()` with transformers to convert it into the
  format your component or condition expects.
- **Register implementations in the package.** Like effects,
  conditions, and transformers, generator implementations are
  scoped to the package that registers them.

---

## Built-in generators

### `Generator.Date.Now()`

Produces the current date and time as a `Date` object with the
full timestamp. Use this when time of day matters.

```typescript
Generator.Date.Now()
Generator.Date.Now().pipe(Transformer.Date.Format('DD/MM/YYYY HH:mm'))
```

### `Generator.Date.Today()`

Produces the current date as a `Date` object with the time set to
midnight (`00:00:00.000`). Use this for date-only comparisons to
avoid subtle issues with time-of-day differences.

```typescript
Generator.Date.Today().pipe(Transformer.Date.Format('DD/MM/YYYY'))
Generator.Date.Today().pipe(Transformer.Date.AddDays(30), Transformer.Date.Format('DD/MM/YYYY'))
```
