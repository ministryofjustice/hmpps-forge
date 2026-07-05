---
title: Strings
section: packages
path: packages/forge-core/transformers-string
teaches: [Transformer.String, string-transformers]
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

String transformers are called as `Transformer.String.<Name>()` and
applied with `.pipe()`:

```typescript
import { Answer, Transformer } from '@ministryofjustice/hmpps-forge/core/authoring'

Answer('fullName').pipe(Transformer.String.Trim())
Answer('postcode').pipe(Transformer.String.ToUpperCase())
Answer('email').pipe(Transformer.String.Trim(), Transformer.String.ToLowerCase())
```

On field definitions, use the `formatters` property to transform the
submitted value before it is stored:

```typescript
GovUKTextInput({
  code: 'email',
  label: { text: 'Email address' },
  formatters: [Transformer.String.Trim(), Transformer.String.ToLowerCase()],
})
```

All arguments that accept a string or number also accept an
expression, so you can use dynamic values:

```typescript
Answer('template').pipe(
  Transformer.String.Replace(Answer('placeholder'), Answer('value')),
)
```

---

## Case

### Trim

Removes whitespace from both ends of a string.

```typescript
Answer('name').pipe(Transformer.String.Trim())
// "  Jane Smith  " -> "Jane Smith"
```

This is the most commonly used string transformer. Apply it as a
`formatter` on text inputs to clean up accidental whitespace before
the value is stored.

### ToUpperCase

Converts the entire string to upper case.

```typescript
Answer('postcode').pipe(Transformer.String.ToUpperCase())
// "sw1a 1aa" -> "SW1A 1AA"
```

### ToLowerCase

Converts the entire string to lower case.

```typescript
Answer('email').pipe(Transformer.String.ToLowerCase())
// "User@Example.COM" -> "user@example.com"
```

### ToTitleCase

Capitalises the first letter of each word.

```typescript
Answer('city').pipe(Transformer.String.ToTitleCase())
// "new york" -> "New York"
```

### Capitalize

Capitalises only the first letter of the string.

```typescript
Answer('location').pipe(Transformer.String.Capitalize())
// "office" -> "Office"
```

### Possessive

Converts a name to its possessive form. Names ending in 's' get
just an apostrophe; others get 's.

```typescript
Answer('name').pipe(Transformer.String.Possessive())
// "John" -> "John's"
// "James" -> "James'"
```

---

## Manipulation

### Substring

Extracts part of a string between a start and optional end index
(zero-based).

```typescript
Answer('reference').pipe(Transformer.String.Substring(0, 4))
// "AB1234" -> "AB12"

Answer('reference').pipe(Transformer.String.Substring(2))
// "AB1234" -> "1234"
```

### Replace

Replaces all occurrences of a search string with a replacement.

```typescript
Answer('phone').pipe(Transformer.String.Replace(' ', ''))
// "07700 900 000" -> "07700900000"
```

Arguments can be dynamic:

```typescript
Data('template').pipe(
  Transformer.String.Replace(Data('search'), Data('replace')),
)
```

### PadStart

Pads the start of a string to a target length. Defaults to padding
with spaces.

```typescript
Answer('day').pipe(Transformer.String.PadStart(2, '0'))
// "5" -> "05"
```

### PadEnd

Pads the end of a string to a target length. Defaults to padding
with spaces.

```typescript
Answer('code').pipe(Transformer.String.PadEnd(6, '0'))
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

```typescript
Answer('quantity').pipe(Transformer.String.ToInt())
// "42" -> 42
// "123.7" -> 123 (truncated)
```

Use as a `formatter` on fields that collect whole numbers as text:

```typescript
GovUKTextInput({
  code: 'quantity',
  label: { text: 'How many?' },
  formatters: [Transformer.String.ToInt()],
})
```

### ToFloat

Converts a string to a floating-point number. Throws on empty
strings or non-numeric content.

```typescript
Answer('price').pipe(Transformer.String.ToFloat())
// "19.99" -> 19.99
```

### ToArray

Splits a string into an array. Without a separator, splits into
individual characters. With a separator, splits on that string.

```typescript
Answer('tags').pipe(Transformer.String.ToArray(','))
// "red,green,blue" -> ["red", "green", "blue"]

Answer('word').pipe(Transformer.String.ToArray())
// "hello" -> ["h", "e", "l", "l", "o"]
```

### ToDate

Converts a date string to a Date object. Supports UK format
(DD/MM/YYYY) and ISO-8601 format (YYYY-MM-DD or full ISO timestamp).
Throws on invalid dates.

```typescript
Answer('startDate').pipe(Transformer.String.ToDate())
// "15/03/2024" -> Date(2024-03-15)
// "2024-03-15" -> Date(2024-03-15)
// "2024-03-15T14:30:00Z" -> Date(2024-03-15T14:30:00Z)
```

### FormatDate

Formats a date string using native `Intl.DateTimeFormat` options.
The locale defaults to `en-GB` and the time zone to
`Europe/London`; when no options are supplied, the output defaults
to a UK long date.

```typescript
Answer('dob').pipe(Transformer.String.FormatDate())
// "2024-03-15" -> "15 March 2024"

Answer('dob').pipe(Transformer.String.FormatDate({ dateStyle: 'short' }))
// "2024-03-15" -> "15/03/2024"

Answer('createdAt').pipe(
  Transformer.String.FormatDate({ dateStyle: 'long', timeZone: 'UTC' }),
)
// "2026-04-27T23:05:36.647Z" -> "27 April 2026"

Answer('dob').pipe(
  Transformer.String.FormatDate({ locale: 'en-US', dateStyle: 'long' }),
)
// "2024-03-15" -> "March 15, 2024"
```

### ToISODate

Converts a UK-formatted date string (DD/MM/YYYY) to ISO-8601 format
(YYYY-MM-DD). Useful when working with the MOJ Date Picker, which
outputs UK format.

```typescript
Answer('dob').pipe(Transformer.String.ToISODate())
// "15/03/2024" -> "2024-03-15"
// "5/3/2024"   -> "2024-03-05"
```

### ToTimestampDate

Converts an epoch millisecond string to a Date object.

```typescript
Data('createdAt').pipe(Transformer.String.ToTimestampDate())
// "1771429146000" -> Date(2026-02-18T15:39:06)
```

---

## Security

### EscapeHtml

Escapes HTML entities (`<`, `>`, `&`, `"`, `'`) to prevent XSS
attacks. Use this when piping untrusted data into HTML contexts
like `HtmlBlock` or `TemplateWrapper` values.

```typescript
Data('userComment').pipe(Transformer.String.EscapeHtml())
// '<script>alert("xss")</script>' -> '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
```

---

## Practical examples

### Clean and normalise form input

Apply multiple formatters to a field to trim whitespace and
normalise case before the value is stored:

```typescript
GovUKTextInput({
  code: 'email',
  label: { text: 'Email address' },
  formatters: [Transformer.String.Trim(), Transformer.String.ToLowerCase()],
})
```

### Normalise a postcode

```typescript
GovUKTextInput({
  code: 'postcode',
  label: { text: 'Postcode' },
  formatters: [Transformer.String.Trim(), Transformer.String.ToUpperCase()],
})
```

### Display a possessive name

Show "John's answers" or "James' answers" in a heading:

```typescript
GovUKHeading({
  text: Format('%1 answers', Answer('fullName').pipe(Transformer.String.Possessive())),
  size: 'l',
})
```

### Convert a date picker value for storage

The MOJ Date Picker outputs DD/MM/YYYY. Convert it to ISO-8601
before saving:

```typescript
GovUKTextInput({
  code: 'appointmentDate',
  label: { text: 'Appointment date' },
  formatters: [Transformer.String.ToISODate()],
})
```
