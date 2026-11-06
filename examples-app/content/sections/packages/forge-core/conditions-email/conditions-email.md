---
title: Email
section: packages
path: packages/forge-core/conditions-email
teaches: [condition::email, email-conditions]
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

```rust
validation(obj! {
    "condition": self_().matches(condition::email::is_valid_email()),
    "message": "Enter a valid email address",
})
```

---

## Practical examples

### Email field with required and format validation

```rust
govuk::TEXT_INPUT.build(obj! {
    "code": "email",
    "label": obj! { "text": "Email address" },
    "inputType": "email",
    "autocomplete": "email",
    "formatters": [transformer::string::trim(), transformer::string::to_lower_case()],
    "validWhen": [
        validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Enter an email address",
        }),
        validation(obj! {
            "condition": self_().matches(condition::email::is_valid_email()),
            "message": "Enter a valid email address",
        }),
    ],
})
```
