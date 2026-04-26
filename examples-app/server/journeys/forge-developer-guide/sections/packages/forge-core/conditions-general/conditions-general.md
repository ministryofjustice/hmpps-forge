---
title: General
section: packages
path: packages/forge-core/conditions-general
teaches: [Condition.IsRequired, Condition.Equals, general-conditions]
prerequisites: [forge-core, conditions]
---

<p class="govuk-caption-xl">Forge Core</p>

# General conditions
General conditions are the most commonly used predicates in Forge.
They check whether a value is present and whether it equals an
expected value. Unlike the other condition groups, they sit directly
on the `Condition` namespace rather than under a sub-group.

{{slot:toc}}

---

## Conditions

### IsRequired

Returns true if the value is considered "present". Returns false
for null, undefined, empty strings (after trimming), and empty
arrays.

```typescript
Self().match(Condition.IsRequired())
```

This is the standard "field must not be blank" validation:

```typescript
validation({
  condition: Self().match(Condition.IsRequired()),
  message: 'Enter your name',
})
```

It also works for checkbox arrays (empty array = nothing selected):

```typescript
validation({
  condition: Self().match(Condition.IsRequired()),
  message: 'Select at least one option',
})
```

### Equals

Returns true if the value is strictly equal (`===`) to the expected
value. The argument can be a static value or an expression.

```typescript
Answer('contactMethod').match(Condition.Equals('email'))
Answer('country').match(Condition.Equals(Data('defaultCountry')))
```

Common uses include branching on a radio selection:

```typescript
redirect({
  when: Answer('contactMethod').match(Condition.Equals('email')),
  goto: 'email-address',
})

redirect({
  when: Answer('contactMethod').match(Condition.Equals('phone')),
  goto: 'phone-number',
})
```

And conditional visibility:

```typescript
GovUKTextInput({
  code: 'otherReason',
  label: { text: 'Please specify' },
  visibleWhen: Answer('reason').match(Condition.Equals('other')),
})
```

---

## Practical examples

### Required field with a max length

```typescript
validWhen: [
  validation({
    condition: Self().match(Condition.IsRequired()),
    message: 'Enter a description',
  }),
  validation({
    condition: Self().match(Condition.String.HasMaxLength(200)),
    message: 'Description must be 200 characters or less',
  }),
]
```

