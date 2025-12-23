# References and Chaining

References are the foundation of the form-engine's data access layer. They provide a declarative way to point to different sources of data within your forms, from field values to external data and HTTP request information.

## What is a Reference?

A reference is a pointer to data that gets resolved at runtime. Instead of hardcoding values, you describe *where* the value comes from, and the form-engine resolves it when needed.

This enables:
- Dynamic content based on user input
- Conditional visibility of fields and blocks
- Validation rules that depend on other fields
- Pre-populating fields from external data
- Building complex expressions from multiple values
- Iterating over arrays with `.each()` and `Item()`

## Reference Types

The form-engine provides seven reference types, each pointing to a different data source:

| Reference | Data Source | Common Use |
|-----------|-------------|------------|
| `Answer('code')` | Field responses | Referencing user input from any field |
| `Data('key')` | External data | API responses, database lookups, configuration |
| `Self()` | Current field | Validation rules, field-scoped logic |
| `Item()` | Iterator item | Accessing current item in `.each()` iterations |
| `Params('key')` | URL path params | Route parameters like `/users/:id` |
| `Query('key')` | URL query string | Query params like `?search=term` |
| `Post('key')` | Raw POST body | Accessing raw submission data |

### Import

```typescript
import {
  Answer, Data, Self, Item, Post, Params, Query, Iterator,
} from '@form-engine/form/builders'
```

---

## `Answer()` - Field Responses

The most commonly used reference type. Retrieves values from form field responses.

### Signature

```typescript
Answer(target: string | FieldDefinition): ReferenceExpr
```

### Basic Usage

```typescript
// Reference by string code
Answer('email')
Answer('firstName')
Answer('dateOfBirth')

// Reference by field definition (provides compile-time safety)
const emailField = field<GovUKTextInput>({
  variant: 'govukTextInput',
  code: 'email',
  label: 'Email address',
})

// These are equivalent:
Answer('email')
Answer(emailField)
```

### Nested Properties

Use dot notation to access nested values:

```typescript
// Object properties
Answer('address.street')
Answer('address.city')
Answer('address.postcode')

// Array access
Answer('contacts.0.email')  // First contact's email
Answer('items.1.quantity')  // Second item's quantity
```

### Common Use Cases

**Dynamic content:**
```typescript
block<HtmlBlock>({
  variant: 'html',
  content: Format('Thank you, %1. We will contact you at %2.',
    Answer('fullName'),
    Answer('email')
  ),
})
```

**Pre-populating fields:**
```typescript
field<GovUKTextInput>({
  code: 'shippingStreet',
  label: 'Street address',
  defaultValue: Answer('billingStreet'),
})
```

**Cross-field validation:**
```typescript
field<GovUKDateInputFull>({
  code: 'endDate',
  validate: [
    validation({
      when: Self().not.match(Condition.Date.IsAfter(Answer('startDate'))),
      message: 'End date must be after the start date',
    }),
  ],
})
```

**Conditional visibility with dependent fields:**

When a field should only appear based on another field's value, use `hidden` to control visibility and `dependent` to control whether validation runs:

```typescript
// The trigger field
field<GovUKRadioInput>({
  variant: 'govukRadioInput',
  code: 'contactMethod',
  fieldset: { legend: { text: 'How should we contact you?' } },
  items: [
    { value: 'email', text: 'Email' },
    { value: 'phone', text: 'Phone' },
    { value: 'other', text: 'Other' },
  ],
})

// The dependent field - only shown when 'other' is selected
field<GovUKTextInput>({
  variant: 'govukTextInput',
  code: 'contactMethodOther',
  label: 'Please specify your preferred contact method',

  // hidden: when should this field be HIDDEN?
  // -> Hide when contactMethod is NOT 'other'
  hidden: Answer('contactMethod').not.match(Condition.Equals('other')),

  // dependent: when should validation RUN?
  // -> Only validate when contactMethod IS 'other'
  dependent: Answer('contactMethod').match(Condition.Equals('other')),

  validate: [
    validation({
      when: Self().not.match(Condition.IsRequired()),
      message: 'Enter your preferred contact method',
    }),
  ],
})
```

The `hidden` and `dependent` properties are typically opposites:
- `hidden`: "Hide this field when the condition is true"
- `dependent`: "Only validate this field when the condition is true"

This ensures that when a field is hidden, its validation is skipped.

---

## `Data()` - External Data

Retrieves values from external data sources loaded via `onLoad` transitions. Use it for API responses, database lookups, and pre-fetched configuration.

### Signature

```typescript
Data(key: string): ReferenceExpr
```

### How Data Gets Loaded

Data must be loaded before you can reference it. This happens in `onLoad` transitions using effects that call `context.setData()`:

```typescript
// In your effects file
export const { effects: MyEffects, createRegistry } =
  defineEffectsWithDeps<{ api: ApiService }>()({
    loadUserProfile: deps => async (context: EffectFunctionContext) => {
      const userId = context.getParams().id
      const user = await deps.api.getUser(userId)
      context.setData('user', user)
    },
  })

// In your step definition
step({
  path: '/profile',
  onLoad: [
    loadTransition({
      effects: [MyEffects.loadUserProfile()],
    }),
  ],
  blocks: [/* ... */],
})
```

> **Warning:** If you reference `Data('user')` without loading it in `onLoad`, the value will be `undefined`.

### Basic Usage

```typescript
// Simple data access
Data('user')
Data('config')
Data('lookupOptions')

// Nested property access
Data('user.email')
Data('user.profile.address.postcode')
Data('config.features.darkMode')
```

### Common Use Cases

**Pre-populating fields:**
```typescript
field<GovUKTextInput>({
  code: 'businessName',
  label: 'Business name',
  defaultValue: Data('existingApplication.businessName'),
})
```

**Dynamic dropdown options:**
```typescript
field<GovUKRadioInput>({
  code: 'country',
  fieldset: { legend: { text: 'Country' } },
  items: Data('countries'),  // Loaded in onLoad
})
```

**Conditional display:**
```typescript
block<HtmlBlock>({
  variant: 'html',
  hidden: Data('user.tier').not.match(Condition.Equals('premium')),
  content: '<p>Premium feature content here...</p>',
})
```

### `Data()` vs `Answer()`

| Aspect | Data() | Answer() |
|--------|--------|----------|
| Source | External (APIs, databases) | User input (form fields) |
| When loaded | `onLoad` transitions | Form submission / defaults |
| Typical use | Lookup data, configuration | Validation, dynamic display |
| Mutability | Set once at load time | Changes with user interaction |

---

## `Self()` - Current Field

References the field that contains this logic. Primarily used in validation rules and field-scoped expressions.

### Signature

```typescript
Self(): ReferenceExpr
```

No parameters required. `Self()` automatically resolves to the nearest containing field's code at compile time.

### How `Self()` Works

When the form-engine compiles your form definition, it transforms `Self()` into an `Answer()` reference with the field's actual code:

```typescript
// You write:
field({
  code: 'email',
  validate: [
    validation({
      when: Self().not.match(Condition.IsRequired()),
      message: 'Enter your email address',
    }),
  ],
})

// The form-engine transforms it to:
field({
  code: 'email',
  validate: [
    validation({
      when: Answer('email').not.match(Condition.IsRequired()),
      message: 'Enter your email address',
    }),
  ],
})
```

### Why Use `Self()`?

- **DRY principle:** You don't repeat the field code, reducing the chance of typos
- **Refactoring safety:** If you rename the field code, validations using `Self()` update automatically
- **Readability:** It's immediately clear the validation applies to "this field"
- **Reusable patterns:** You can extract common validation patterns that work with any field

### Primary Use: Validation

```typescript
field<GovUKTextInput>({
  variant: 'govukTextInput',
  code: 'fullName',
  label: 'Full name',
  validate: [
    // 1. Required check
    validation({
      when: Self().not.match(Condition.IsRequired()),
      message: 'Enter your full name',
    }),
    // 2. Format check
    validation({
      when: Self().not.match(Condition.String.HasMinLength(2)),
      message: 'Full name must be at least 2 characters',
    }),
    // 3. Business rule
    validation({
      when: Self().not.match(Condition.String.LettersWithSpaceDashApostrophe()),
      message: 'Full name must only contain letters, spaces, hyphens and apostrophes',
    }),
  ],
})
```

### Restrictions

`Self()` can only be used inside a field block. Using it elsewhere will throw a compilation error.

**Valid locations:**
- `validate` array
- `hidden` condition
- `dependent` condition
- Any expression within the field definition

**Invalid locations:**
- Inside the field's own `code` property (would cause infinite recursion)
- Outside any field block (no "self" to reference)
- In step-level or journey-level configurations

---

## `Item()` - Iterator Items

Accesses values from the current item during `.each()` iteration. Use it with `Iterator.Map`, `Iterator.Filter`, and `Iterator.Find` to transform, filter, and search arrays.

### Signature

```typescript
Item(): ScopedReference
```

Returns a scoped reference with methods to access the current item's data:
- `Item().path('key')` - Access a property of the current item
- `Item().value()` - Get the entire item value
- `Item().index()` - Get the current iteration index (0-based)
- `Item().key()` - Get the property name when iterating over objects
- `Item().parent` - Navigate to the parent scope (for nested iterations)

### Basic Usage

```typescript
// Access properties
Item().path('name')
Item().path('id')
Item().path('address.city')

// Get the full item object
Item().value()

// Get the current index
Item().index()  // 0, 1, 2, ...

// Get the key (when iterating objects)
Item().key()  // property name
```

### Transforming Arrays with Iterator.Map

```typescript
// Transform data for radio/checkbox items
field<GovUKRadioInput>({
  code: 'country',
  items: Data('countries').each(
    Iterator.Map({
      value: Item().path('code'),
      text: Item().path('name'),
    })
  ),
})

// Transform with computed values
items: Data('users').each(
  Iterator.Map({
    value: Item().path('id'),
    text: Format('%1 (%2)', Item().path('name'), Item().path('email')),
  })
)
```

### Filtering Arrays

```typescript
// Filter out the current selection
items: Data('areas')
  .each(Iterator.Filter(
    Item().path('slug').not.match(Condition.Equals(Params('currentArea')))
  ))
  .each(Iterator.Map({
    value: Item().path('value'),
    text: Item().path('text'),
  }))
```

### Finding Items

```typescript
// Find a specific item by ID
label: Data('categories')
  .each(Iterator.Find(
    Item().path('id').match(Condition.Equals(Answer('selectedCategory')))
  ))
  .path('name')
```

### Nested Iterations

When iterations are nested, `Item()` refers to the innermost iteration. Use `.parent` to access outer scopes:

```typescript
// Data structure:
// departments: [
//   { name: 'Engineering', employees: [{ name: 'Alice' }, { name: 'Bob' }] },
//   { name: 'Sales', employees: [{ name: 'Carol' }] }
// ]

// Flatten employees with their department names
Data('departments')
  .each(Iterator.Map(
    Item().path('employees').each(Iterator.Map({
      employeeName: Item().path('name'),
      departmentName: Item().parent.path('name'),
    }))
  ))
  .pipe(Transformer.Array.Flatten())

// Scope levels:
Item()                // Current (innermost) iteration item
Item().parent         // Parent iteration item
Item().parent.parent  // Grandparent iteration item
```

### Restrictions

`Item()` can only be used inside an `.each()` iterator. Using it outside will throw a runtime error because there is no active iteration scope.

See [Using Iterators](./using-iterators.md) for comprehensive iterator documentation.

---

## HTTP References

Three reference types access data from the HTTP request. These are always available without needing to load data first.

### `Params()` - URL Path Parameters

Access URL path parameters (route parameters):

```typescript
Params(key: string): ReferenceExpr
```

Path parameters are defined in your route with a colon prefix:

```typescript
// Route: /applications/:applicationId/edit
// URL:   /applications/abc123/edit

Params('applicationId')  // Returns: 'abc123'

// Multiple parameters
// Route: /users/:userId/orders/:orderId
// URL:   /users/user_1/orders/order_42

Params('userId')   // Returns: 'user_1'
Params('orderId')  // Returns: 'order_42'
```

**Common use cases:**

```typescript
// Load data based on route parameter
loadApplication: deps => async (context: EffectFunctionContext) => {
  const id = context.getParams().applicationId
  const application = await deps.api.getApplication(id)
  context.setData('application', application)
}

// Display the ID in content
block<HtmlBlock>({
  variant: 'html',
  content: Format('Application: %1', Params('applicationId')),
})

// Include in redirect URL
next({ goto: Format('/applications/%1/submitted', Params('applicationId')) })
```

### `Query()` - Query String Parameters

Access URL query string parameters:

```typescript
Query(key: string): ReferenceExpr
```

Query parameters come after the `?` in the URL:

```typescript
// URL: /search?term=widget&category=electronics&page=2

Query('term')      // Returns: 'widget'
Query('category')  // Returns: 'electronics'
Query('page')      // Returns: '2' (always a string!)
```

> **Note:** Query parameters are always strings. Use `Transformer.String.ToInt()` or `Transformer.String.ToFloat()` if you need a numeric value.

**Common use cases:**

```typescript
// Pre-fill a search field
field<GovUKTextInput>({
  code: 'searchTerm',
  label: 'Search',
  defaultValue: Query('q'),
})

// Show content based on query param
block<HtmlBlock>({
  variant: 'html',
  hidden: Query('showHelp').not.match(Condition.Equals('true')),
  content: '<p>Help content here...</p>',
})
```

### `Post()` - Raw POST Body

Access raw form submission data (before any transformations):

```typescript
Post(key: string): ReferenceExpr
```

`Post()` gives you access to the raw HTTP POST body data. Unlike `Answer()`, this is the untransformed input exactly as submitted.

```typescript
// User submits form with:
// email = "  TEST@Example.COM  "

Post('email')    // Returns: "  TEST@Example.COM  " (raw input)
Answer('email')  // Returns: "test@example.com" (after trim + lowercase formatters)
```

### `Post()` vs `Answer()`

| Aspect | Post() | Answer() |
|--------|--------|----------|
| Formatters applied? | No | Yes |
| Default value fallback? | No | Yes |
| When available | Only on form submission | Always (may be undefined) |
| Typical use | Action transitions, debugging | Display, validation, logic |

**Common use cases:**

```typescript
// Check which button was clicked in action transitions
actionTransition({
  when: Post('action').match(Condition.Equals('lookup')),
  effects: [MyEffects.lookupPostcode(Post('postcode'))],
})

submitTransition({
  when: Post('action').match(Condition.Equals('save')),
  validate: true,
  onValid: { next: [next({ goto: 'next-step' })] },
})
```

### HTTP Reference Availability

| Reference | Source | When Available |
|-----------|--------|----------------|
| `Params()` | URL path segments | Always (on routes with params) |
| `Query()` | URL query string | Always (may be undefined) |
| `Post()` | HTTP POST body | Only after form submission |

---

## The Chaining API

Every reference returns a chainable object that supports fluent method chaining for transformations and condition testing.

### Chain Methods

| Method | Purpose | Returns |
|--------|---------|---------|
| `.pipe(...transformers)` | Transform value through pipeline | Chainable expression |
| `.path('key')` | Navigate to nested property | Chainable reference |
| `.not` | Negate next `.match()` | Same type (negated) |
| `.match(condition)` | Test value against condition | Boolean expression (terminal) |

### `.match()` - Condition Testing

Tests a reference value against a condition, returning a boolean expression:

```typescript
// Basic condition matching
Answer('country').match(Condition.Equals('UK'))
Answer('age').match(Condition.Number.GreaterThan(18))
Self().not.match(Condition.IsRequired())

// Use in validation
validation({
  when: Self().not.match(Condition.IsRequired()),
  message: 'Enter your full name',
})

// Use in hidden condition
field({
  code: 'ukDetails',
  hidden: Answer('country').not.match(Condition.Equals('UK')),
})
```

### `.not` - Negating Conditions

Use `.not` before `.match()` to invert the condition:

```typescript
// "Show error when value is NOT a valid email"
Self().not.match(Condition.Email.IsValidEmail())

// "Show error when value is NOT at least 8 characters"
Self().not.match(Condition.String.HasMinLength(8))

// "Hide field when user has NOT selected 'other'"
Answer('selection').not.match(Condition.Equals('other'))
```

> **Important:** `.not` can only be used before `.match()`. To negate combinators like `and()` or `or()`, wrap them with `not()`.

### `.pipe()` - Transformation Pipelines

Pass the reference value through one or more transformers:

```typescript
// Single transformer
Answer('email').pipe(Transformer.String.ToLowerCase())

// Multiple transformers (executed left to right)
Answer('email').pipe(
  Transformer.String.Trim(),
  Transformer.String.ToLowerCase()
)

// Chain with conditions
Answer('quantity')
  .pipe(Transformer.String.ToInt())
  .match(Condition.Number.GreaterThan(0))
```

**Common pipeline patterns:**

```typescript
// Clean string input
Answer('postcode').pipe(
  Transformer.String.Trim(),
  Transformer.String.ToUpperCase()
)
// "  sw1a 1aa  " -> "SW1A 1AA"

// Parse and format numbers
Answer('price').pipe(
  Transformer.String.ToFloat(),
  Transformer.Number.ToFixed(2)
)
// "99.999" -> "100.00"

// Array length for validation
Answer('selections').pipe(
  Transformer.Array.Length()
)
// ["a", "b", "c"] -> 3

// Calculate values
Answer('quantity').pipe(
  Transformer.String.ToInt(),
  Transformer.Number.Multiply(10)
)
```

### `.path()` - Nested Property Access

Navigate to nested properties. Prefer dot notation in the reference itself for static paths:

```typescript
// Preferred: Dot notation in the reference
Answer('user.address.postcode')
Data('config.settings.theme')

// Use .path() for dynamic keys
Item().path('name')
Item().path(dynamicKey)
```

### Full Chain Example

```typescript
// Transform -> negate -> match
Answer('price')
  .pipe(Transformer.String.ToFloat())
  .not.match(Condition.Number.LessThan(0))
```

---

## Related: Expressions and Logic

References are often combined with expression builders like `Format()`, `Conditional()`, and predicate combinators (`and()`, `or()`, `not()`). See [Logic and Expressions](logic-and-expressions.md) for comprehensive coverage of:

- **Value expressions:** `Format()` for string interpolation
- **Conditional expressions:** `when()` and `Conditional()` for if/then/else logic
- **Predicate combinators:** `and()`, `or()`, `xor()`, `not()` for complex conditions

For iterating over arrays, see [Using Iterators](./using-iterators.md).

---

## Best Practices

### Use `Self()` for Current Field Validation

```typescript
// DO: Use Self() for current field
field<GovUKTextInput>({
  code: 'email',
  validate: [
    validation({
      when: Self().not.match(Condition.IsRequired()),
      message: 'Enter your email address',
    }),
  ],
})

// DON'T: Use Answer() to reference the same field
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

### Use `.not` for Validation Conditions

Validation `when` should express "show error when NOT valid":

```typescript
// DO: Negative match (shows error when invalid)
validation({
  when: Self().not.match(Condition.IsRequired()),
  message: 'Enter your email',
})

// DON'T: Positive match (shows error when valid!)
validation({
  when: Self().match(Condition.IsRequired()),
  message: 'Enter your email',
})
```

### Prefer Dot Notation Over `.path()`

```typescript
// DO: All dot notation for static paths
Answer('user.address.postcode')
Data('config.settings.theme')

// DON'T: Mix dot notation with .path()
Answer('user.address').path('postcode')
Data('config').path('settings.theme')

// DO: Use .path() only for dynamic keys
Item().path(dynamicKey)
```

### Handle Missing Values

```typescript
// Use Conditional with a fallback
field<GovUKTextInput>({
  code: 'searchTerm',
  defaultValue: Conditional({
    when: Query('q').match(Condition.IsRequired()),
    then: Query('q'),
    else: '',
  }),
})
```

### Prefer `Answer()` Over `Post()`

In most cases, you want the formatted/cleaned value:

```typescript
// DO: Use Answer() for validation and display
validation({
  when: Answer('email').not.match(Condition.Email.IsValidEmail()),
  message: 'Enter a valid email address',
})

// Use Post() only for action detection
actionTransition({
  when: Post('action').match(Condition.Equals('lookup')),
  effects: [MyEffects.lookupPostcode(Post('postcode'))],
})
```
