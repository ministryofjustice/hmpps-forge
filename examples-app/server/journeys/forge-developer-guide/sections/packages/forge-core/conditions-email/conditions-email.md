---
title: Email
section: packages
path: packages/forge-core/conditions-email
teaches: [Condition.Email, email-conditions]
prerequisites: [forge-core, conditions]
---

<p class="govuk-caption-xl">Forge Core</p>

# Email conditions
Email conditions validate email address format.

{{slot:toc}}

---

## Conditions

### IsValidEmail

Returns true if the string is a properly formatted email address
with a valid domain structure.

```typescript
validation({
  condition: Self().match(Condition.Email.IsValidEmail()),
  message: 'Enter a valid email address',
})
```

---

## Practical examples

### Email field with required and format validation

```typescript
GovUKTextInput({
  code: 'email',
  label: { text: 'Email address' },
  type: 'email',
  autocomplete: 'email',
  formatters: [Transformer.String.Trim(), Transformer.String.ToLowerCase()],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter an email address',
    }),
    validation({
      condition: Self().match(Condition.Email.IsValidEmail()),
      message: 'Enter a valid email address',
    }),
  ],
})
```
