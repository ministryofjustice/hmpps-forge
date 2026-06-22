---
title: Arrays
section: packages
path: packages/forge-core/conditions-array
teaches: [Condition.Array, array-conditions]
prerequisites: [forge-core, conditions]
---

<p class="govuk-caption-xl">Forge Core</p>

# Array conditions
Array conditions test membership and containment - whether a value
is in a list, whether a list contains a value, and whether lists
overlap. They are used for checkbox validation, role checks, and
filtering logic.

{{slot:toc}}

---

## How to use them

```typescript
import { Answer, Data, Session, Condition } from '@ministryofjustice/hmpps-forge/core/authoring'

Answer('role').match(Condition.Array.IsIn(['admin', 'editor']))
Answer('selectedTags').match(Condition.Array.Contains('urgent'))
Session('roles').match(Condition.Array.ContainsAny(['admin', 'superuser']))
```

---

## Conditions

### IsArray

Tests whether a given value is an array.

```typescript
Answer('status').match(Condition.Array.IsArray())
// ["this", "is", "an", "array"] -> true, "this is not an array" -> false
```

### IsIn

Tests whether a single value exists in a given array. The value
being tested is the left side; the array to search is the argument.

```typescript
Answer('status').match(Condition.Array.IsIn(['active', 'pending']))
// "active" -> true, "closed" -> false
```

Useful for branching on one of several accepted values:

```typescript
redirect({
  when: Answer('preference').match(Condition.Array.IsIn(['email', 'text'])),
  goto: 'contact-details',
})
```

### Contains

Tests whether an array contains a specific value. The array is the
left side; the value to find is the argument.

```typescript
Answer('selectedOptions').match(Condition.Array.Contains('other'))
// ["email", "other"] -> true, ["email", "phone"] -> false
```

### ContainsAny

Tests whether an array contains at least one value from another
array.

```typescript
Session('roles').match(Condition.Array.ContainsAny(['admin', 'manager']))
// ["admin", "viewer"] -> true, ["viewer"] -> false
```

### ContainsAll

Tests whether every item in the value array exists in the expected
array. Order does not matter. Returns true for empty value arrays.

```typescript
Answer('selected').match(Condition.Array.ContainsAll(['a', 'b', 'c', 'd']))
// ["a", "c"] -> true (both exist in expected)
// ["a", "x"] -> false (x not in expected)
```

---

## Practical examples

### Checkbox must include a specific option

```typescript
validation({
  condition: Self().match(Condition.Array.Contains('consent')),
  message: 'You must agree to the terms',
})
```

### Role-based access

Show a block only when the user has an admin or manager role:

```typescript
GovUKButton({
  text: 'Delete record',
  visibleWhen: Session('roles').match(Condition.Array.ContainsAny(['admin', 'manager'])),
})
```

### Branching on multiple accepted answers

```typescript
redirect({
  when: Answer('channel').match(Condition.Array.IsIn(['email', 'text', 'letter'])),
  goto: 'contact-preferences',
})
```
