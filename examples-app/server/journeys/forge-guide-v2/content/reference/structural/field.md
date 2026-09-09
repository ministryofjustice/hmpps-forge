---
title: field()
slug: field
section: reference
path: reference/field
nav: Authoring API/Structural
order: 13
description: Creates a field block that captures and prepares an answer
teaches: [field, code, defaultValue, formatters, parsers, validation, dependentWhen, multiple]
prerequisites: [step, block]
related:
  concept: how-answers-work, how-validation-works
  reference: block, validation
---

# `field()`

`field()` creates an input block for a step. The field's `code` identifies the answer
that Forge prepares, validates, and makes available to the rest of the journey.

```typescript
const emailAddressField = field({
  variant: 'govukTextInput',
  code: 'emailAddress',
  label: 'Email address',
})
```

---

## Reference

### `field(definition)`

Call `field()` to create a field block definition. Its `variant` selects the registered
component that renders the control; its `code` identifies the answer the control owns.

[See more examples below.](#usage)

```typescript
function field<D extends FieldBlockDefinition>(definition: Omit<D, '_forge'>): D
```

#### Parameters

:::param
---
name: definition
type: Omit<D, '_forge'>
required: true
---
An object describing one field component and the answer it owns. Its shared and
field-specific properties are listed below.
:::

#### Definition properties

:::param
---
name: variant
type: string
required: true
---
The registered component to render this field, matching the component's variant name.
Forge validates that the variant matches a registered component when it registers the
package.

Calling a component sets its variant and carries its registration entry. See
[Call a component](#call-a-component).
:::

:::param
---
name: code
type: ResolvableString
required: true
---
The answer key for this field. Forge uses the resolved value to prepare, store, validate,
and read the answer. It accepts a string or an expression for fields created in an
iterator.

Use a stable domain name such as `'emailAddress'`, rather than a component or page
position such as `'textInput1'`.

[Learn how field codes create answers.](../concepts/how-answers-work)
:::

:::param
---
name: defaultValue
type: ResolvableString | ResolvableString[] | FunctionExpr
required: false
---
The value to use when a `GET` starts with no answer for this field. It can be a literal,
an answer or data expression, an array, or a generator function. An existing loaded
answer takes precedence.
:::

:::param
---
name: formatters
type: TransformerFunctionExpr[]
required: false
---
Transformers applied to a submitted value after Forge has normalised it. Use formatters
to store a canonical value, such as a trimmed email address. They do not change values
loaded for display.
:::

:::param
---
name: parsers
type: TransformerFunctionExpr[]
required: false
---
Transformers applied to a loaded answer before rendering. Use parsers to prepare a
stored value for the field component without changing the stored answer.
:::

:::param
---
name: validWhen
type: (ValidationExpr | IterateExpr | ChainableIterable)[] | IterateExpr | ChainableIterable
required: false
---
Validation rules for this answer. All resolved rules must pass for the field to be valid.
Failures attach to this field when validation errors are shown.

[Learn how to write field validation rules.](../concepts/how-validation-works)
:::

:::param
---
name: dependentWhen
type: PredicateExpr
required: false
---
Controls whether this answer applies. On a `POST`, Forge clears the prepared answer and
skips its validation when the predicate is false. It does not control whether the field
is rendered; use `visibleWhen` for that.
:::

:::param
---
name: visibleWhen
type: ResolvableBoolean
required: false
---
Controls whether the field produces output for the current request. Accepts a boolean or
an expression. When omitted, the field is visible.
:::

:::param
---
name: metadata
type: Record<string, unknown>
required: false
---
Additional information for an application, such as `{ analyticsId: 'email-address' }`.
Forge preserves this information on the resolved field but does not give it built-in
behaviour.
:::

#### Returns

`field()` returns a field block definition. Add it to a step's `blocks` array.

#### Caveats

- `visibleWhen` does not change answer behaviour. Hiding a field does not clear its
  answer or skip its validation. Use `dependentWhen` when the answer only applies while
  the same condition is true.

- When `dependentWhen` clears an answer during `POST` answer preparation, Forge does not
  apply `defaultValue` in its place. The answer remains absent for that request.

- Whether a field accepts multiple values is determined by the [`component()`](./component)
  declaration's `multiple` option. It cannot be configured on individual field definitions.

---

## Usage

### Call a component

A field component is callable. Calling it creates a field definition with typed props
and carries the component's registration entry:

```typescript
const emailAddressField = GovUKTextInput({
  code: 'emailAddress',
  label: 'Email address',
})
```

`createForgePackage()` collects the entry from the journey automatically.

### Set a default and format submitted input

Use `defaultValue` to seed an answer that is missing on a `GET`, and `formatters` to
normalise a submitted value:

```typescript
const emailAddressField = GovUKTextInput({
  code: 'emailAddress',
  label: 'Email address',
  defaultValue: Data('profile.emailAddress'),
  formatters: [Transformer.String.Trim(), Transformer.String.ToLowerCase()],
})
```

If Forge has already loaded an `emailAddress` answer, it uses that answer instead of the
default. On submission, the formatters trim and lowercase the new value before validation
and submit hooks read it.

### Validate and depend on another answer

Put rules that belong to one answer on its field. Add `dependentWhen` when the answer
only applies while another answer has a particular value:

```typescript
const emailAddressField = GovUKTextInput({
  code: 'emailAddress',
  label: 'Email address',
  visibleWhen: Answer('contactMethod').match(Condition.Equals('email')),
  dependentWhen: Answer('contactMethod').match(Condition.Equals('email')),
  validWhen: [
    validation({
      condition: Self().match(Condition.Email.IsValidEmail()),
      message: 'Enter an email address in the correct format',
    }),
  ],
})
```

When the contact method is not email, `visibleWhen` hides the control. On a `POST`,
`dependentWhen` also clears its answer and skips the field's validation.

---

## Troubleshooting

### Forge reports an unregistered component variant

No component has been registered for the field's `variant`. Check the exact variant
string, then register the relevant component package or application component when Forge
is configured.

### The field shows the wrong value

Loaded answers take precedence over `defaultValue`. Check the answer loaded for the
field's code before changing the default.

If the stored answer needs a different display shape, add a parser. Use a formatter only
when changing submitted input before it is stored.

### A field accepts only one submitted value

Forge keeps the first non-empty submitted value unless the component declaration sets
`multiple: true`. Check the component's configuration. Setting `multiple` on an individual
field definition does not change how submitted values are prepared.
