---
title: Address
section: packages
path: packages/forge-core/conditions-address
teaches: [condition::address, address-conditions]
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

```rust
validation(obj! {
    "condition": self_().matches(condition::address::is_valid_postcode()),
    "message": "Enter a valid UK postcode",
})
// "SW1A 1AA" -> true
// "sw1a1aa" -> true (case-insensitive)
// "12345" -> false
```

---

## Practical examples

### Postcode field with trim and validation

```rust
govuk::TEXT_INPUT.build(obj! {
    "code": "postcode",
    "label": obj! { "text": "Postcode" },
    "autocomplete": "postal-code",
    "classes": classes::input::WIDTH_10,
    "formatters": [transformer::string::trim(), transformer::string::to_upper_case()],
    "validWhen": [
        validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Enter a postcode",
        }),
        validation(obj! {
            "condition": self_().matches(condition::address::is_valid_postcode()),
            "message": "Enter a valid UK postcode",
        }),
    ],
})
```
