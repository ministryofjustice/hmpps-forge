---
title: Address
section: packages
path: packages/forge-core/conditions-address
teaches: [Condition.Address, address-conditions]
prerequisites: [forge-core, conditions]
---

<p class="govuk-caption-xl">Forge Core</p>

# Address conditions
Address conditions validate address components.

{{slot:toc}}

---

## Conditions

### IsValidPostcode

Returns true if the string is a valid UK postcode format.

```typescript
validation({
  condition: Self().match(Condition.Address.IsValidPostcode()),
  message: 'Enter a valid UK postcode',
})
// "SW1A 1AA" -> true
// "sw1a1aa" -> true (case-insensitive)
// "12345" -> false
```

---

## Practical examples

### Postcode field with trim and validation

```typescript
GovUKTextInput({
  code: 'postcode',
  label: { text: 'Postcode' },
  autocomplete: 'postal-code',
  classes: GovUKUtilityClasses.Input.Width10,
  formatters: [Transformer.String.Trim(), Transformer.String.ToUpperCase()],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter a postcode',
    }),
    validation({
      condition: Self().match(Condition.Address.IsValidPostcode()),
      message: 'Enter a valid UK postcode',
    }),
  ],
})
```
