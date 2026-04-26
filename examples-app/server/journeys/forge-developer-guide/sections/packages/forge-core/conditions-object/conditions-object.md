---
title: Objects
section: packages
path: packages/forge-core/conditions-object
teaches: [Condition.Object, object-conditions]
prerequisites: [forge-core, conditions]
---

<p class="govuk-caption-xl">Forge Core</p>

# Object conditions
Object conditions test the structure of objects - whether a value is
an object, whether it has a property, and whether that property has
a value. They are useful for validating composite fields and
checking loaded data.

{{slot:toc}}

---

## How to use them

```typescript
import { Self, Data, Condition } from '@ministryofjustice/hmpps-forge/core/authoring'

Self().match(Condition.Object.IsObject())
Data('record').match(Condition.Object.HasProperty('address.line1'))
Data('record').match(Condition.Object.PropertyHasValue('email'))
```

---

## Conditions

### IsObject

Returns true if the value is a plain object (not null, not an
array).

```typescript
Self().match(Condition.Object.IsObject())
// {} -> true, { a: 1 } -> true
// null -> false, [] -> false, "string" -> false
```

### HasProperty

Returns true if the object has a property at the given path.
Supports dot notation for nested properties.

```typescript
Data('user').match(Condition.Object.HasProperty('address'))
Data('user').match(Condition.Object.HasProperty('address.postcode'))
```

### PropertyIsEmpty

Returns true if the property at the given path is null, undefined,
or an empty string (after trimming).

```typescript
Data('record').match(Condition.Object.PropertyIsEmpty('notes'))
```

### PropertyHasValue

Returns true if the property at the given path has a non-empty
value. The inverse of `PropertyIsEmpty`.

```typescript
Data('record').match(Condition.Object.PropertyHasValue('email'))
```

---

## Practical examples

### Conditionally show a section based on loaded data

```typescript
GovUKSummaryList({
  rows: addressRows,
  visibleWhen: Data('record').match(Condition.Object.PropertyHasValue('address.line1')),
})
```

### Validate a composite field has all parts

```typescript
validWhen: [
  validation({
    condition: Self().match(Condition.Object.PropertyHasValue('year')),
    message: 'Enter a year',
  }),
  validation({
    condition: Self().match(Condition.Object.PropertyHasValue('month')),
    message: 'Enter a month',
  }),
  validation({
    condition: Self().match(Condition.Object.PropertyHasValue('day')),
    message: 'Enter a day',
  }),
]
```
