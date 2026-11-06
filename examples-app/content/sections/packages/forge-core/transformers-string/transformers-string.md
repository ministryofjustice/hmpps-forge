---
title: Strings
section: packages
path: packages/forge-core/transformers-string
teaches: [transformer::string, string-transformers]
prerequisites: [forge-core, transformers]
---

<p class="govuk-caption-xl">Forge Core</p>

# String transformers
String transformers manipulate text values - trimming whitespace,
changing case, replacing content, converting to other types, and
escaping HTML. They are applied through `.pipe()` on references
and through the `formatters` property on fields.

{{slot:toc}}

---

## How to use them

String transformers are called as `transformer::string::<name>()` and
applied with `.pipe()`:

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};

answer("fullName").pipe([transformer::string::trim()])
answer("postcode").pipe([transformer::string::to_upper_case()])
answer("email").pipe([transformer::string::trim(), transformer::string::to_lower_case()])
```

On field definitions, use the `formatters` property to transform the
submitted value before it is stored:

```rust
govuk::TEXT_INPUT.build(obj! {
    "code": "email",
    "label": obj! { "text": "Email address" },
    "formatters": [transformer::string::trim(), transformer::string::to_lower_case()],
})
```

All arguments that accept a string or number also accept an
expression, so you can use dynamic values:

```rust
answer("template").pipe([transformer::string::replace(answer("placeholder"), answer("value"))])
```

---

## Case

### Trim

Removes whitespace from both ends of a string.

```rust
answer("name").pipe([transformer::string::trim()])
// "  Jane Smith  " -> "Jane Smith"
```

This is the most commonly used string transformer. Apply it as a
`formatter` on text inputs to clean up accidental whitespace before
the value is stored.

### ToUpperCase

Converts the entire string to upper case.

```rust
answer("postcode").pipe([transformer::string::to_upper_case()])
// "sw1a 1aa" -> "SW1A 1AA"
```

### ToLowerCase

Converts the entire string to lower case.

```rust
answer("email").pipe([transformer::string::to_lower_case()])
// "User@Example.COM" -> "user@example.com"
```

### ToTitleCase

Capitalises the first letter of each word.

```rust
answer("city").pipe([transformer::string::to_title_case()])
// "new york" -> "New York"
```

### Capitalize

Capitalises only the first letter of the string.

```rust
answer("location").pipe([transformer::string::capitalize()])
// "office" -> "Office"
```

### Possessive

Converts a name to its possessive form. Names ending in 's' get
just an apostrophe; others get 's.

```rust
answer("name").pipe([transformer::string::possessive()])
// "John" -> "John's"
// "James" -> "James'"
```

---

## Manipulation

### Substring

Extracts part of a string between a start and optional end index
(zero-based).

```rust
answer("reference").pipe([transformer::string::substring(0, 4)])
// "AB1234" -> "AB12"
answer("reference").pipe([transformer::string::substring(2, Value::Undefined)])
// "AB1234" -> "1234"
```

### Replace

Replaces all occurrences of a search string with a replacement.

```rust
answer("phone").pipe([transformer::string::replace(" ", "")])
// "07700 900 000" -> "07700900000"
```

Arguments can be dynamic:

```rust
data("template").pipe([transformer::string::replace(data("search"), data("replace"))])
```

### PadStart

Pads the start of a string to a target length. Defaults to padding
with spaces.

```rust
answer("day").pipe([transformer::string::pad_start(2, "0")])
// "5" -> "05"
```

### PadEnd

Pads the end of a string to a target length. Defaults to padding
with spaces.

```rust
answer("code").pipe([transformer::string::pad_end(6, "0")])
// "123" -> "123000"
```

---

## Type conversion

These transformers convert a string value into another type. They
throw on invalid input, which causes the pipeline to preserve the
original value.

### ToInt

Converts a string to an integer. Whitespace is trimmed
automatically. Throws on empty strings, non-numeric content, or
partial matches.

```rust
answer("quantity").pipe([transformer::string::to_int()])
// "42" -> 42
// "123.7" -> 123 (truncated)
```

Use as a `formatter` on fields that collect whole numbers as text:

```rust
govuk::TEXT_INPUT.build(obj! {
    "code": "quantity",
    "label": obj! { "text": "How many?" },
    "formatters": [transformer::string::to_int()],
})
```

### ToFloat

Converts a string to a floating-point number. Throws on empty
strings or non-numeric content.

```rust
answer("price").pipe([transformer::string::to_float()])
// "19.99" -> 19.99
```

### ToArray

Splits a string into an array. Without a separator, splits into
individual characters. With a separator, splits on that string.

```rust
answer("tags").pipe([transformer::string::to_array(",")])
// "red,green,blue" -> ["red", "green", "blue"]
answer("word").pipe([transformer::string::to_array(Value::Undefined)])
// "hello" -> ["h", "e", "l", "l", "o"]
```

### ToDate

Converts a date string to a Date object. Supports UK format
(DD/MM/YYYY) and ISO-8601 format (YYYY-MM-DD or full ISO timestamp).
Throws on invalid dates.

```rust
answer("startDate").pipe([transformer::string::to_date()])
// "15/03/2024" -> Date(2024-03-15)
// "2024-03-15" -> Date(2024-03-15)
// "2024-03-15T14:30:00Z" -> Date(2024-03-15T14:30:00Z)
```

### FormatDate

Formats a date string using native `Intl.DateTimeFormat` options.
The locale defaults to `en-GB` and the time zone to
`Europe/London`; when no options are supplied, the output defaults
to a UK long date.

```rust
answer("dob").pipe([transformer::string::format_date(Value::Undefined)])
// "2024-03-15" -> "15 March 2024"
answer("dob").pipe([transformer::string::format_date(obj! { "dateStyle": "short" })])
// "2024-03-15" -> "15/03/2024"
answer("createdAt").pipe([transformer::string::format_date(obj! { "dateStyle": "long", "timeZone": "UTC" })])
// "2026-04-27T23:05:36.647Z" -> "27 April 2026"
answer("dob").pipe([transformer::string::format_date(obj! { "locale": "en-US", "dateStyle": "long" })])
// "2024-03-15" -> "March 15, 2024"
```

### ToISODate

Converts a UK-formatted date string (DD/MM/YYYY) to ISO-8601 format
(YYYY-MM-DD). Useful when working with the MOJ Date Picker, which
outputs UK format.

```rust
answer("dob").pipe([transformer::string::to_iso_date()])
// "15/03/2024" -> "2024-03-15"
// "5/3/2024"   -> "2024-03-05"
```

### ToTimestampDate

Converts an epoch millisecond string to a Date object.

```rust
data("createdAt").pipe([transformer::string::to_timestamp_date()])
// "1771429146000" -> Date(2026-02-18T15:39:06)
```

---

## Security

### EscapeHtml

Escapes HTML entities (`<`, `>`, `&`, `"`, `'`) to prevent XSS
attacks. Use this when piping untrusted data into HTML contexts
like `core_blocks::HTML` or `core_blocks::TEMPLATE_WRAPPER` values.

```rust
data("userComment").pipe([transformer::string::escape_html()])
// '<script>alert("xss")</script>' -> '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
```

---

## Practical examples

### Clean and normalise form input

Apply multiple formatters to a field to trim whitespace and
normalise case before the value is stored:

```rust
govuk::TEXT_INPUT.build(obj! {
    "code": "email",
    "label": obj! { "text": "Email address" },
    "formatters": [transformer::string::trim(), transformer::string::to_lower_case()],
})
```

### Normalise a postcode

```rust
govuk::TEXT_INPUT.build(obj! {
    "code": "postcode",
    "label": obj! { "text": "Postcode" },
    "formatters": [transformer::string::trim(), transformer::string::to_upper_case()],
})
```

### Display a possessive name

Show "John's answers" or "James' answers" in a heading:

```rust
govuk::HEADING.build(obj! {
    "text": format("%1 answers", [answer("fullName").pipe([transformer::string::possessive()]).into()]),
    "size": "l",
})
```

### Convert a date picker value for storage

The MOJ Date Picker outputs DD/MM/YYYY. Convert it to ISO-8601
before saving:

```rust
govuk::TEXT_INPUT.build(obj! {
    "code": "appointmentDate",
    "label": obj! { "text": "Appointment date" },
    "formatters": [transformer::string::to_iso_date()],
})
```
