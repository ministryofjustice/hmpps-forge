# Logic and Expressions

The form-engine uses a declarative expression system for dynamic content, conditional behavior, and validation rules. This document covers how to build expressions that evaluate values, test conditions, and branch logic.

## What is an Expression?

An expression is a declarative description of a value or condition that gets evaluated at runtime. Instead of hardcoding values, you describe *how* to compute them, and the form-engine evaluates them when needed.

This enables:
- Dynamic content that changes based on user input
- Conditional field visibility and validation
- String interpolation with multiple data sources
- Complex boolean logic for business rules
- Iterating over collections to generate repeated content

## Expression Types

| Expression | Purpose | Example |
|------------|---------|---------|
| `Format()` | String interpolation | `Format('Hello, %1!', Answer('name'))` |
| `Collection()` | Iterate arrays | `Collection({ collection, template })` |
| `Conditional()` | Conditional (object) | `Conditional({ when, then, else })` |
| `when()` | Conditional (fluent) | `when(predicate).then('A').else('B')` |
| `.pipe()` | Transform values | `Answer('email').pipe(Transformer.String.Trim())` |
| `.match()` | Test a condition | `Answer('age').match(Condition.Number.GreaterThan(18))` |
| `.not.match()` | Test negated condition | `Self().not.match(Condition.IsRequired())` |
| `and()`, `or()`, `xor()`, `not()` | Combine predicates | `and(isAdmin, isVerified)` |

### Import

```typescript
import {
  // Value expressions
  Format, Collection,
  // Conditional expressions
  Conditional, when,
  // Predicate combinators
  and, or, xor, not
} from '@form-engine/form/builders'
```

---

## `Format()` - String Interpolation

Combines references into formatted strings using numbered placeholders (`%1`, `%2`, etc.):

```typescript
import { Format, Answer, Data } from '@form-engine/form/builders'

// Basic placeholders
Format('Hello, %1!', Answer('firstName'))
// → "Hello, John!"

Format('%1 %2', Answer('firstName'), Answer('lastName'))
// → "John Smith"

// Use in HTML content
block<HtmlBlock>({
  variant: 'html',
  content: Format(
    '<h1>Welcome, %1</h1><p>Your email: %2</p>',
    Answer('name'),
    Answer('email')
  ),
})

// Combine with transformers
Format('Total: £%1',
  Answer('price').pipe(Transformer.Number.ToFixed(2))
)
```

**Placeholder rules:**
- Numbered 1-based: `%1`, `%2`, `%3`, etc.
- Can reuse placeholders: `Format('Hello %1, your username is %1', Answer('username'))`
- Arguments resolved left-to-right

## `.pipe()` - Transformation Pipelines

Transform values through sequential steps:

```typescript
// Single transformer
Answer('email').pipe(Transformer.String.Trim())

// Multiple transformers (left-to-right)
Answer('email').pipe(
  Transformer.String.Trim(),
  Transformer.String.ToLowerCase()
)

// Transform then use in Format
Format('Total: £%1',
  Answer('price').pipe(Transformer.Number.ToFixed(2))
)
```

---

## `.match()` - Condition Testing

Predicates produce boolean values for use in conditional logic, validation, and visibility rules. The basic building block is testing a reference value against a condition:

```typescript
import { Answer, Self, Condition } from '@form-engine/form/builders'

// Pattern: Reference().match(condition)
Answer('country').match(Condition.Equals('UK'))
Self().match(Condition.IsRequired())
Answer('age').match(Condition.Number.GreaterThan(18))
```

## `.not` - Negating Conditions

Place `.not` before `.match()` to invert the result:

```typescript
// "value is NOT required" (is empty)
Self().not.match(Condition.IsRequired())

// "email is NOT valid"
Answer('email').not.match(Condition.Email.IsValidEmail())

// Transform → negate → match
Answer('price')
  .pipe(Transformer.String.ToFloat())
  .not.match(Condition.Number.LessThan(0))
```

> **Important:** `.not` can only be used before `.match()` on references. To negate compound predicates, use the `not()` function instead.

---

## Predicate Combinators

Combine multiple predicates with logical operators:

```typescript
import { and, or, xor, not, Answer, Condition } from '@form-engine/form/builders'
```

### `and()` - All Must Be True

```typescript
// Both conditions must be satisfied
and(
  Answer('age').match(Condition.Number.GreaterThan(18)),
  Answer('hasConsent').match(Condition.Equals(true))
)

// Validation: required only when another field has value
validation({
  when: and(
    Answer('hasEmail').match(Condition.Equals('yes')),
    Self().not.match(Condition.IsRequired())
  ),
  message: 'Enter your email address',
})
```

### `or()` - At Least One Must Be True

```typescript
// Either condition is sufficient
or(
  Answer('role').match(Condition.Equals('admin')),
  Answer('role').match(Condition.Equals('manager'))
)

// Accept multiple valid formats
or(
  Self().match(Condition.String.MatchesRegex('^[0-9]{5}$')),
  Self().match(Condition.String.MatchesRegex('^[0-9]{5}-[0-9]{4}$'))
)
```

### `xor()` - Exactly One Must Be True

```typescript
// Mutually exclusive options
xor(
  Answer('pickup').match(Condition.Equals(true)),
  Answer('delivery').match(Condition.Equals(true))
)

// Validation: exactly one contact method
validation({
  when: xor(
    Answer('email').match(Condition.IsRequired()),
    Answer('phone').match(Condition.IsRequired())
  ).not,
  message: 'Provide either email or phone, but not both',
})
```

### `not()` - Negate a Predicate

```typescript
// Negate a simple predicate
not(Answer('isBlocked').match(Condition.Equals(true)))

// Negate compound predicates (can't use .not here)
not(
  and(
    Answer('hasPermission').match(Condition.Equals(true)),
    Answer('isVerified').match(Condition.Equals(true))
  )
)

// NOT (A OR B) = neither A nor B
not(
  or(
    Answer('status').match(Condition.Equals('blocked')),
    Answer('status').match(Condition.Equals('suspended'))
  )
)
```

### Nesting Combinators

Nest combinators to create complex logic:

```typescript
// (A AND B) OR C
or(
  and(
    Answer('hasAccount').match(Condition.Equals(true)),
    Answer('isVerified').match(Condition.Equals(true))
  ),
  Answer('guestCheckout').match(Condition.Equals(true))
)

// A AND (B OR C)
and(
  Answer('termsAccepted').match(Condition.Equals(true)),
  or(
    Answer('paymentMethod').match(Condition.Equals('card')),
    Answer('paymentMethod').match(Condition.Equals('paypal'))
  )
)
```

---

## `when()` - Fluent Conditionals

Conditional expressions return different values based on a predicate. The `when()` function provides a fluent API:

```typescript
import { when, Answer, Condition } from '@form-engine/form/builders'

// Basic structure
when(predicate)
  .then(valueIfTrue)
  .else(valueIfFalse)

// Examples
when(Answer('country').match(Condition.Equals('UK')))
  .then('Postcode')
  .else('ZIP Code')

// else is optional (returns undefined when false)
when(Answer('isPremium').match(Condition.Equals(true)))
  .then('Premium features enabled')
```

## `Conditional()` - Object Syntax

An alternative object-based API:

```typescript
import { Conditional, Answer, Condition } from '@form-engine/form/builders'

// Basic structure
Conditional({
  when: predicate,
  then: valueIfTrue,
  else: valueIfFalse,  // optional
})

// Example
Conditional({
  when: Answer('country').match(Condition.Equals('UK')),
  then: 'Postcode',
  else: 'ZIP Code',
})
```

### Choosing Between `when()` and `Conditional()`

| Use Case | Recommended |
|----------|-------------|
| Simple conditionals | Either (personal preference) |
| Inline in properties | `when()` (more concise) |
| Deeply nested logic | `Conditional()` (clearer structure) |
| Complex predicates | `Conditional()` (easier to read) |

### Nested Conditionals

For multiple conditions, nest conditionals in the `else` branch:

```typescript
// Using when()
when(Answer('tier').match(Condition.Equals('premium')))
  .then('Premium Support (24/7)')
  .else(
    when(Answer('tier').match(Condition.Equals('standard')))
      .then('Standard Support (9-5)')
      .else('Basic Support (email only)')
  )

// Using Conditional()
Conditional({
  when: Answer('tier').match(Condition.Equals('premium')),
  then: 'Premium Support (24/7)',
  else: Conditional({
    when: Answer('tier').match(Condition.Equals('standard')),
    then: 'Standard Support (9-5)',
    else: 'Basic Support (email only)',
  }),
})
```

### Using Expressions as Values

The `then` and `else` values can be any expression:

```typescript
// Reference values
Conditional({
  when: Answer('useBusinessAddress').match(Condition.Equals(true)),
  then: Data('business.address'),
  else: Answer('homeAddress'),
})

// Format expressions
when(Answer('hasTitle').match(Condition.Equals(true)))
  .then(Format('%1 %2', Answer('title'), Answer('name')))
  .else(Answer('name'))

// Nested conditionals
Conditional({
  when: Answer('country').match(Condition.Equals('UK')),
  then: 'British Pound (£)',
  else: Conditional({
    when: Answer('country').match(Condition.Equals('US')),
    then: 'US Dollar ($)',
    else: 'Euro (€)',
  }),
})
```

---

## `Collection()` - Iterating Arrays

Iterate over arrays to generate repeated blocks:

```typescript
import { Collection, Data, Item, block, field, Format } from '@form-engine/form/builders'

block<CollectionBlock>({
  variant: 'collection-block',
  collection: Collection({
    collection: Data('items'),           // Data source (array)
    template: [/* blocks per item */],   // Rendered for each item
    fallback: [/* empty state */],       // Optional: shown when empty
  }),
})
```

### `Item()` - Accessing Collection Items

Inside a collection template, `Item()` accesses the current item:

```typescript
// Access item properties
Item().path('name')
Item().path('address.postcode')

// Get the full item object
Item().value()

// Get the current index (0-based)
Item().index()

// Access parent scope (nested collections)
Item().parent.path('categoryName')
```

### Basic Usage

```typescript
block<CollectionBlock>({
  variant: 'collection-block',
  collection: Collection({
    collection: Data('people'),
    template: [
      block<HtmlBlock>({
        variant: 'html',
        content: Format(
          '<p><strong>%1</strong>: %2</p>',
          Item().path('name'),
          Item().path('email')
        ),
      }),
    ],
    fallback: [
      block<HtmlBlock>({
        variant: 'html',
        content: '<p>No people found.</p>',
      }),
    ],
  }),
})
```

### Dynamic Field Codes

```typescript
Collection({
  collection: Data('items'),
  template: [
    field<GovUKTextInput>({
      variant: 'govukTextInput',
      code: Format('item_%1_name', Item().index()),
      label: Format('Name for item %1',
        Item().index().pipe(Transformer.Number.Add(1))
      ),
      defaultValue: Item().path('name'),
    }),
  ],
})
// Generates: item_0_name, item_1_name, item_2_name, ...
```

### Nested Collections

```typescript
// Structure: categories[].items[]
Collection({
  collection: Data('categories'),
  template: [
    block<HtmlBlock>({
      variant: 'html',
      content: Format('<h2>%1</h2>', Item().path('name')),
    }),
    block<CollectionBlock>({
      variant: 'collection-block',
      collection: Collection({
        collection: Item().path('items'),
        template: [
          block<HtmlBlock>({
            variant: 'html',
            content: Format(
              '<p>%1 (Category: %2)</p>',
              Item().path('name'),         // Inner item
              Item().parent.path('name')   // Outer item
            ),
          }),
        ],
      }),
    }),
  ],
})
```

---

## Expression Placement

Different expression types are valid in different contexts:

| Property | Valid Expressions | Example |
|----------|-------------------|---------|
| `content` | Format, Conditional, references | `Format('<p>%1</p>', Answer('name'))` |
| `label`, `hint` | Format, Conditional, references | `when(...).then('A').else('B')` |
| `hidden` | Predicates | `Answer('type').not.match(Condition.Equals('other'))` |
| `dependent` | Predicates | `Answer('type').match(Condition.Equals('other'))` |
| `validate.when` | Predicates | `Self().not.match(Condition.IsRequired())` |
| `defaultValue` | Conditional, references, Format | `Data('user.name')` |
| `collection` | Data, Item paths, Answer | `Data('items')` or `Item().path('children')` |

---

## Best Practices

### Extract Complex Predicates

```typescript
// DO: Named predicates
const isBusinessUser = Answer('accountType').match(Condition.Equals('business'))
const hasValidTaxId = Answer('taxId').match(Condition.IsRequired())
const isVerified = Data('user.verified').match(Condition.Equals(true))

when(and(isBusinessUser, hasValidTaxId, isVerified))
  .then('/business-dashboard')
  .else('/personal-dashboard')

// DON'T: Inline everything
when(
  and(
    Answer('accountType').match(Condition.Equals('business')),
    Answer('taxId').match(Condition.IsRequired()),
    Data('user.verified').match(Condition.Equals(true))
  )
).then('/business-dashboard').else('/personal-dashboard')
```

### Choose the Right Combinator

| Situation | Use |
|-----------|-----|
| All conditions must be met | `and(a, b, c)` |
| Any condition is sufficient | `or(a, b, c)` |
| Exactly one must be true | `xor(a, b)` |
| Invert a compound predicate | `not(and(...))` or `not(or(...))` |
| Invert a single condition | `.not.match()` |

### Use `.not` for Validation Conditions

Validation `when` should express "show error when NOT valid":

```typescript
// DO: "Show error when NOT valid"
validation({
  when: Self().not.match(Condition.IsRequired()),
  message: 'Enter your email address',
})

// DON'T: "Show error when valid" (confusing!)
validation({
  when: Self().match(Condition.IsRequired()),
  message: 'Enter your email address',
})
```

### Use `Self()` for Current Field Validation

```typescript
// DO: Self() for current field
field<GovUKTextInput>({
  code: 'email',
  validate: [
    validation({
      when: Self().not.match(Condition.IsRequired()),
      message: 'Enter your email address',
    }),
  ],
})

// DON'T: Answer() to reference same field
field<GovUKTextInput>({
  code: 'email',
  validate: [
    validation({
      when: Answer('email').not.match(Condition.IsRequired()),
      message: 'Enter your email address',
    }),
  ],
})
```

---

## Common Patterns

### Conditional Required Field

```typescript
// Required only when another field has specific value
validation({
  when: and(
    Answer('contactPreference').match(Condition.Equals('email')),
    Self().not.match(Condition.IsRequired())
  ),
  message: 'Enter your email address',
})
```

### Cross-Field Validation

```typescript
// End date must be after start date
validation({
  when: and(
    Answer('startDate').match(Condition.IsRequired()),
    Self().not.match(Condition.Date.IsAfter(Answer('startDate')))
  ),
  message: 'End date must be after start date',
})
```

### At Least One of Multiple Fields

```typescript
// Provide at least one contact method
validation({
  when: not(
    or(
      Answer('email').match(Condition.IsRequired()),
      Answer('phone').match(Condition.IsRequired()),
      Answer('address').match(Condition.IsRequired())
    )
  ),
  message: 'Provide at least one contact method',
})
```

### Dynamic Labels Based on Context

```typescript
field<GovUKTextInput>({
  code: 'postalCode',
  label: when(Answer('country').match(Condition.Equals('US')))
    .then('ZIP Code')
    .else('Postcode'),
  hint: Conditional({
    when: Answer('country').match(Condition.Equals('US')),
    then: 'For example, 90210',
    else: 'For example, SW1A 1AA',
  }),
})
```

### Conditional Visibility

```typescript
// Show field only when condition met
field<GovUKTextInput>({
  code: 'otherContactMethod',
  label: 'Please specify',
  hidden: Answer('contactMethod').not.match(Condition.Equals('other')),
  dependent: Answer('contactMethod').match(Condition.Equals('other')),
})
```
