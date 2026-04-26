---
title: Strings
section: packages
path: packages/forge-core/conditions-string
teaches: [Condition.String, string-conditions]
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

```typescript
import { Self, Condition } from '@ministryofjustice/hmpps-forge/core/authoring'

Self().match(Condition.String.HasMaxLength(100))
Self().match(Condition.String.MatchesRegex('^[A-Z]{2}\\d{6}$'))
```

---

## Length

### HasMinLength

Returns true if the string length is at least the minimum.

```typescript
validation({
  condition: Self().match(Condition.String.HasMinLength(2)),
  message: 'Must be at least 2 characters',
})
```

### HasMaxLength

Returns true if the string length does not exceed the maximum.

```typescript
validation({
  condition: Self().match(Condition.String.HasMaxLength(100)),
  message: 'Must be 100 characters or less',
})
```

### HasExactLength

Returns true if the string is exactly the specified length.

```typescript
validation({
  condition: Self().match(Condition.String.HasExactLength(6)),
  message: 'Reference must be exactly 6 characters',
})
```

### HasMaxWords

Returns true if the word count does not exceed the maximum.

```typescript
validation({
  condition: Self().match(Condition.String.HasMaxWords(150)),
  message: 'Must be 150 words or less',
})
```

---

## Character sets

### LettersOnly

Only letters (A-Z, a-z).

```typescript
validation({
  condition: Self().match(Condition.String.LettersOnly()),
  message: 'Must only contain letters',
})
```

### DigitsOnly

Only digits (0-9).

```typescript
validation({
  condition: Self().match(Condition.String.DigitsOnly()),
  message: 'Must only contain numbers',
})
```

### LettersAndDigitsOnly

Alphanumeric characters only.

```typescript
validation({
  condition: Self().match(Condition.String.LettersAndDigitsOnly()),
  message: 'Must only contain letters and numbers',
})
```

### LettersWithSpaceDashApostrophe

Letters, spaces, dashes, and apostrophes. Useful for name fields.

```typescript
validation({
  condition: Self().match(Condition.String.LettersWithSpaceDashApostrophe()),
  message: 'Name must only contain letters, spaces, hyphens and apostrophes',
})
```

### LettersWithCommonPunctuation

Letters and common punctuation (. , ' " ( ) - ! ? and space).

```typescript
validation({
  condition: Self().match(Condition.String.LettersWithCommonPunctuation()),
  message: 'Must only contain letters and common punctuation',
})
```

### AlphanumericWithCommonPunctuation

Alphanumeric characters and common punctuation.

```typescript
Self().match(Condition.String.AlphanumericWithCommonPunctuation())
```

### AlphanumericWithAllSafeSymbols

Alphanumeric characters and a broad set of safe symbols
(. , ; : ' " ( ) - ! ? @ # $ % ^ & *).

```typescript
Self().match(Condition.String.AlphanumericWithAllSafeSymbols())
```

---

## Pattern matching

### MatchesRegex

Returns true if the string matches a regular expression pattern.

```typescript
validation({
  condition: Self().match(Condition.String.MatchesRegex('^[A-Z]{2}\\d{6}$')),
  message: 'Enter a valid reference number (for example AB123456)',
})
```

### StartsWith

Returns true if the string starts with the specified prefix.

```typescript
Answer('url').match(Condition.String.StartsWith('https://'))
```

### EndsWith

Returns true if the string ends with the specified suffix.

```typescript
Answer('email').match(Condition.String.EndsWith('@example.com'))
```

### Contains

Returns true if the string contains the specified substring.

```typescript
Answer('description').match(Condition.String.Contains('urgent'))
```

---

## Practical examples

### Name field validation

```typescript
validWhen: [
  validation({
    condition: Self().match(Condition.IsRequired()),
    message: 'Enter your name',
  }),
  validation({
    condition: Self().match(Condition.String.HasMaxLength(100)),
    message: 'Name must be 100 characters or less',
  }),
  validation({
    condition: Self().match(Condition.String.LettersWithSpaceDashApostrophe()),
    message: 'Name must only contain letters, spaces, hyphens and apostrophes',
  }),
]
```

### Free text area with word limit

```typescript
validWhen: [
  validation({
    condition: Self().match(Condition.IsRequired()),
    message: 'Enter a description',
  }),
  validation({
    condition: Self().match(Condition.String.HasMaxWords(200)),
    message: 'Description must be 200 words or less',
  }),
]
```
