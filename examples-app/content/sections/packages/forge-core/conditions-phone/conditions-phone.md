---
title: Phone
section: packages
path: packages/forge-core/conditions-phone
teaches: [condition::phone, phone-conditions]
prerequisites: [forge-core, conditions]
---

<p class="govuk-caption-xl">Forge Core</p>

# Phone conditions
Phone conditions validate phone number formats.

{{slot:toc}}

---

## Conditions

### IsValidPhoneNumber

Returns true if the string is a valid phone number format. Accepts
international format with an optional `+` prefix and common
separators (spaces, dashes, dots, parentheses). Requires 7 to 20
characters of digits and separators.

```rust
validation(obj! {
    "condition": self_().matches(condition::phone::is_valid_phone_number()),
    "message": "Enter a valid phone number",
})
// "07700 900 000" -> true
// "+44 7700 900000" -> true
// "123" -> false (too short)
```

### IsValidUKMobile

Returns true if the string is a valid UK mobile phone number.
Accepts formats like `07xxx xxxxxx`, `+447xxx xxxxxx`, and
`(07xxx) xxxxxx`.

```rust
validation(obj! {
    "condition": self_().matches(condition::phone::is_valid_uk_mobile()),
    "message": "Enter a valid UK mobile number",
})
// "07700 900 000" -> true
// "+44 7700 900000" -> true
// "0208 123 4567" -> false (landline)
```

---

## Practical examples

### Phone number field with format validation

```rust
govuk::TEXT_INPUT.build(obj! {
    "code": "phone",
    "label": obj! { "text": "Phone number" },
    "inputType": "tel",
    "autocomplete": "tel",
    "formatters": [transformer::string::trim()],
    "validWhen": [
        validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Enter a phone number",
        }),
        validation(obj! {
            "condition": self_().matches(condition::phone::is_valid_phone_number()),
            "message": "Enter a valid phone number, like 07700 900 000",
        }),
    ],
})
```
