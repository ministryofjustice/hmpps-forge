---
title: Generators
section: authoring-language
path: authoring-language/generators
teaches: [Generator, Generator.Date.Now, Generator.Date.Today]
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

When the built-in set does not cover what you need (UUIDs, reference
numbers, computed defaults), you can define your own. Custom
generators plug into the same `.pipe()` pipeline as the built-ins
and are used in definitions the same way.

See [Building custom generators](building-functions-and-components/custom-generators)
for the shape interface, implementation, and registration details.

---

## Best practices

- **Use generators for pure value production.** If the value
  depends on external state like an API, session, or database, an
  effect with `context.setData()` is a better fit. Generators are
  for values that can be produced without side effects.
- **Pipe generators to shape the output.** A generator produces a
  raw value. Use `.pipe()` with transformers to convert it into the
  format your component or condition expects.

---

## Built-in generators

For the full reference of every built-in generator with detailed
descriptions and examples, see the Forge Core package pages:

- [Date generators](/forge-developer-guide/packages/forge-core/generators-date) — `Now()`, `Today()`
