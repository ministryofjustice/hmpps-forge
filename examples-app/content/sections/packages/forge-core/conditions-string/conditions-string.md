---
title: Strings
section: packages
path: packages/forge-core/conditions-string
teaches: [condition::string, string-conditions]
prerequisites: [forge-core, conditions]
---

<p class="govuk-caption-xl">Forge Core</p>

# String conditions
String conditions validate text values - length, pattern matching,
character sets, and substring checks. They are the main tool for
field validation on text inputs.

{{slot:toc}}

---

## How to use them

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};

self_().matches(condition::string::has_max_length(100))
self_().matches(condition::string::matches_regex("^[A-Z]{2}\\d{6}$"))
```

---

## Length

### HasMinLength

Returns true if the string length is at least the minimum.

```rust
validation(obj! {
    "condition": self_().matches(condition::string::has_min_length(2)),
    "message": "Must be at least 2 characters",
})
```

### HasMaxLength

Returns true if the string length does not exceed the maximum.

```rust
validation(obj! {
    "condition": self_().matches(condition::string::has_max_length(100)),
    "message": "Must be 100 characters or less",
})
```

### HasExactLength

Returns true if the string is exactly the specified length.

```rust
validation(obj! {
    "condition": self_().matches(condition::string::has_exact_length(6)),
    "message": "Reference must be exactly 6 characters",
})
```

### HasMaxWords

Returns true if the word count does not exceed the maximum.

```rust
validation(obj! {
    "condition": self_().matches(condition::string::has_max_words(150)),
    "message": "Must be 150 words or less",
})
```

---

## Character sets

### LettersOnly

Only letters (A-Z, a-z).

```rust
validation(obj! {
    "condition": self_().matches(condition::string::letters_only()),
    "message": "Must only contain letters",
})
```

### DigitsOnly

Only digits (0-9).

```rust
validation(obj! {
    "condition": self_().matches(condition::string::digits_only()),
    "message": "Must only contain numbers",
})
```

### LettersAndDigitsOnly

Alphanumeric characters only.

```rust
validation(obj! {
    "condition": self_().matches(condition::string::letters_and_digits_only()),
    "message": "Must only contain letters and numbers",
})
```

### LettersWithSpaceDashApostrophe

Letters, spaces, dashes, and apostrophes. Useful for name fields.

```rust
validation(obj! {
    "condition": self_().matches(condition::string::letters_with_space_dash_apostrophe()),
    "message": "Name must only contain letters, spaces, hyphens and apostrophes",
})
```

### LettersWithCommonPunctuation

Letters and common punctuation (. , ' " ( ) - ! ? and space).

```rust
validation(obj! {
    "condition": self_().matches(condition::string::letters_with_common_punctuation()),
    "message": "Must only contain letters and common punctuation",
})
```

### AlphanumericWithCommonPunctuation

Alphanumeric characters and common punctuation.

```rust
self_().matches(condition::string::alphanumeric_with_common_punctuation())
```

### AlphanumericWithAllSafeSymbols

Alphanumeric characters and a broad set of safe symbols
(. , ; : ' " ( ) - ! ? @ # $ % ^ & *).

```rust
self_().matches(condition::string::alphanumeric_with_all_safe_symbols())
```

---

## Pattern matching

### MatchesRegex

Returns true if the string matches a regular expression pattern.

```rust
validation(obj! {
    "condition": self_().matches(condition::string::matches_regex("^[A-Z]{2}\\d{6}$")),
    "message": "Enter a valid reference number (for example AB123456)",
})
```

### StartsWith

Returns true if the string starts with the specified prefix.

```rust
answer("url").matches(condition::string::starts_with("https://"))
```

### EndsWith

Returns true if the string ends with the specified suffix.

```rust
answer("email").matches(condition::string::ends_with("@example.com"))
```

### Contains

Returns true if the string contains the specified substring.

```rust
answer("description").matches(condition::string::contains("urgent"))
```

---

## Practical examples

### Name field validation

```rust
"validWhen": [
    validation(obj! {
        "condition": self_().matches(condition::is_required()),
        "message": "Enter your name",
    }),
    validation(obj! {
        "condition": self_().matches(condition::string::has_max_length(100)),
        "message": "Name must be 100 characters or less",
    }),
    validation(obj! {
        "condition": self_().matches(condition::string::letters_with_space_dash_apostrophe()),
        "message": "Name must only contain letters, spaces, hyphens and apostrophes",
    }),
],
```

### Free text area with word limit

```rust
"validWhen": [
    validation(obj! {
        "condition": self_().matches(condition::is_required()),
        "message": "Enter a description",
    }),
    validation(obj! {
        "condition": self_().matches(condition::string::has_max_words(200)),
        "message": "Description must be 200 words or less",
    }),
],
```
