# Data/Value References Documentation

## Overview

References are the foundation of the form system's data access layer. 
They provide a way to point to different sources of data within your forms, 
from field valuesm, to external data and HTTP request information. All references can be 
used directly in logic expressions and support the fluent predicate API.

## Reference Types

The form system provides several reference functions that access different data sources:

- **`Self()`** - Current field being evaluated
- **`Answer()`** - Form field values
- **`Data()`** - Data loaded at step level (external, from sets, generated etc.)
- **`Item()`** - Current collection item
- **`Post()`** - Form submission data
- **`Params()`** - URL parameters
- **`Query()`** - Query string parameters

## 1. Self() - Current Field Reference
> [!NOTE]  
> Self() solves a specific problem: when a field's code uses
> dynamic expressions like `Format('item_%1_notes', Item('id'))`, you would otherwise
> have to copy that exact same complex expression into every validation rule that needs
> to reference the field's own value.

References the field that contains this logic. Primarily used in validation 
and conditional logic within a field's own configuration.

### Basic Usage

```typescript
// Validation: check if current field is empty
validate: [
  when(Self().not.match(Condition.IsRequired()))
    .then('This field is required')
]

// Check field length
validate: [
  when(Self().not.match(Condition.HasMaxLength(100)))
    .then('Must be 100 characters or less')
]

// Dependency: show field only if it has a value
dependent: when(Self().match(Condition.IsRequired()))
```

### Advanced Self() Usage

```typescript
// Complex validation combining multiple conditions
validate: [
  when(
    and(
      Self().match(Condition.IsRequired()),
      Self().not.match(Condition.IsEmail())
    )
  ).then('Please enter a valid email address'),
  
  // Conditional validation based on field's own value
  when(
    and(
      Self().match(Condition.StartsWith('temp_')),
      Self().not.match(Condition.HasMinLength(10))
    )
  ).then('Temporary codes must be at least 10 characters')
]
```

### JSON Output

```typescript
// Self() reference
{
  type: 'ExpressionType.Reference',
  path: ['@self']
}
```

## 2. Answer() - Form Field References

References values from other fields in the current form. This is the primary 
way to create cross-field dependencies and validation.

### Referencing by Field Code

```typescript
// Reference field by string code
when(Answer('email').match(Condition.IsEmail()))

// Cross-field validation
validate: [
  when(Answer('password').not.match(Condition.MatchesValue(Self())))
    .then('Passwords must match')
]

// Conditional field display
dependent: when(Answer('account_type').match(Condition.MatchesValue('business')))
```

### Referencing by Field Definition

```typescript
// Reference by field definition object
const emailField = field({
  variant: 'email',
  code: 'user_email',
  label: 'Email Address'
})

const confirmEmailField = field({
  variant: 'email',
  code: 'confirm_email',
  label: 'Confirm Email',
  validate: [
    when(Answer(emailField).not.match(Condition.MatchesValue(Self())))
      .then('Email addresses must match')
  ]
})
```

### Complex Cross-Field Logic

```typescript
// Multiple field dependencies
dependent: when(
  and(
    Answer('has_children').match(Condition.Equals(true)),
    Answer('child_count').match(Condition.GreaterThan(0))
  )
)

// Conditional validation based on other fields
validate: [
  when(
    and(
      Answer('requires_phone').match(Condition.MatchesValue(true)),
      Self().not.match(Condition.IsRequired())
    )
  ).then('Phone number is required when contact preference is phone'),
  
  // Date range validation
  when(
    and(
      Answer('start_date').match(Condition.IsRequired()),
      Self().not.match(Condition.GreaterThan(Answer('start_date')))
    )
  ).then('End date must be after start date')
]
```

### JSON Output

```typescript
// Answer('email') reference
{
  type: 'ExpressionType.Reference',
  path: ['answers', 'email']
}
```

## 3. Data() - External Data References

References data that has been loaded at the step level through plugins, APIs, 
or other external sources. This data is typically loaded once when the step renders.

### Basic Data Access

```typescript
// Check user's role from external data
when(Data('user.role').match(Condition.Equals('admin')))
  .then('/admin-dashboard')
  .else('/user-dashboard')

// Feature flag checking
dependent: when(Data('features.advancedMode').match(Condition.Equals(true)))

// Session data
when(Data('session.remainingTime').match(Condition.LessThan(300)))
  .then('Session expiring soon')
```

### Nested Data Properties

```typescript
// Deep object access using dot notation
when(Data('user.profile.preferences.theme').match(Condition.Equals('dark')))
  .then('Apply dark theme styles')

// Array data access
when(Data('user.permissions').match(Condition.Contains('edit')))
  .then('Show edit button')

// Numeric data comparisons
when(Data('subscription.tier.maxUsers').match(Condition.GreaterThan(10)))
  .then('Enterprise features available')
```

### Using Data in Field Configuration

```typescript
// Dynamic field options from external data
const countryField = field({
  variant: 'select',
  code: 'country',
  label: 'Country',
  // items would be populated from Data('countries') at runtime
  dependent: when(Data('countries').match(Condition.IsRequired()))
})

// Conditional field behavior based on external settings
const advancedSettingsField = field({
  variant: 'fieldset',
  legend: 'Advanced Settings',
  dependent: when(
    and(
      Data('features.advanced').match(Condition.Equals(true)),
      Data('user.experienceLevel').match(Condition.In(['intermediate', 'expert']))
    )
  ),
  blocks: [/* advanced fields */]
})
```

### JSON Output

```typescript
// Data('user.role') reference
{
  type: 'ExpressionType.Reference',
  path: ['data', 'user.role']
}
```

## 4. Item() - Collection Item References
References the current item when inside a collection context. Provides its own fluent API for
referring to properties, parent, and index of the current iterating item in a Collection.

### Referencing the Entire Item

```typescript
// Reference the whole current item
when(Item().value().match(Condition.MatchesValue({ someProperty: '1', someOtherProperty: '2' ))

// Referencing the index for use in field codes
field({
  variant: 'text',
  code: Format('item_%1_notes', Item().index()),
  label: 'Notes'
})
```

### Referencing Item Properties

```typescript
// Reference specific properties of the current item
when(Item().property('isAdmin').match(Condition.MatchesValue(true)))
  .then('Show edit controls')
```

### Referencing Parent
For when you have collections within collections

```typescript
code: Format('org_%1_dept_%2_emp_%3_name',
  Item().parent.parent.property('organisationId'),  // Organization ID
  Item().parent.property('departmentId'),           // Department ID  
  Item().property('employeeId')                     // Employee ID
),
```

### Complex Item Logic

```typescript
// Multiple item property checks
dependent: when(
  and(
    Item.property('available').match(Condition.MatchesValue(true)),
    Item.index().match(Condition.GreaterThan(0)),
    Item.property('category').not.match(Condition.MatchesValue('restricted'))
  )
)

// Validation based on item properties
validate: [
  when(
    and(
      Item.property('required').match(Condition.MatchesValue(true)),
      Self().not.match(Condition.IsRequired())
    )
  ).then('This item requires a value'),
  
  when(
    and(
      Item.property('maxLength').match(Condition.IsRequired()),
      Self().not.match(Condition.HasMaxLength(Item.property('maxLength')))
    )
  ).then(Format('Must be %1 characters or less', Item.property('maxLength')))
]
```

## 5. Request Data References

Access different parts of the HTTP request data during form processing.

### Post() - Form Submission Data
> [!WARNING]  
> I'm not 100% how this differs from `Answers()` yet. I guess this is _pre_ processing,
> though i've not added processing/formatting into any of the definitions yet (**DEFINITELY NEEDS IT**)
> Probably adds a bit of tension because when to use Post() vs when to use Answers()

References data from the current form submission (POST request body).

```typescript
// Check which button was clicked
when(Post('action').match(Condition.Equals('save_draft')))
  .then('Save as draft')

when(Post('action').match(Condition.Equals('submit')))
  .then('Full validation and submit')

// Access submitted form values (before processing)
when(Post('user_type').match(Condition.Equals('admin')))
  .then('Apply admin validation rules')

// Multi-step form navigation
next: when(Post('continue').match(Condition.Equals('yes')))
  .then('/next-step')
  .else('/alternative-path')
```

### Params() - URL Parameters

References URL path parameters (e.g., `/users/:id/edit`).

```typescript
// Load data based on URL parameter
when(Params('id').match(Condition.IsRequired()))
  .then('Load existing user data')

// Conditional behavior based on route
when(Params('mode').match(Condition.Equals('edit')))
  .then('Show edit controls')
  .else('Show view-only controls')

// Validation based on context
validate: [
  when(
    and(
      Params('action').match(Condition.Equals('create')),
      Self().not.match(Condition.IsRequired())
    )
  ).then('Name is required when creating new items')
]
```

### Query() - Query String Parameters

References query string parameters (e.g., `?tab=advanced&view=detailed`).

```typescript
// Show different UI based on query params
when(Query('tab').match(Condition.Equals('advanced')))
  .then('Show advanced fields')

when(Query('view').match(Condition.Equals('detailed')))
  .then('Show detailed view')

// Default values from query string
field({
  variant: 'text',
  code: 'search_term',
  label: 'Search',
  value: Query('q'), // Pre-populate from ?q=searchterm
})

// Conditional validation
dependent: when(Query('strict_mode').match(Condition.Equals('true')))
```

### JSON Output

```typescript
// Post('action') reference
{
  type: 'ExpressionType.Reference',
  path: ['post', 'action']
}

// Params('id') reference  
{
  type: 'ExpressionType.Reference',
  path: ['params', 'id']
}

// Query('tab') reference
{
  type: 'ExpressionType.Reference',
  path: ['query', 'tab']
}
```

## 6. Fluent Predicate API

All reference functions support the fluent predicate API, allowing you to chain condition checks directly.
Read more about this in the `logic-and-predicates` doc.

### Direct Predicate Building

```typescript
// Negation
Answer('email').not.match(Condition.IsRequired())
Data('user.role').not.match(Condition.MatchesValue('admin'))
Self().not.match(Condition.HasMaxLength(100))

// Semantic aliases
Item('status').passes(Condition.MatchesValue('active'))
Answer('age').satisfies(Condition.GreaterThan(18))
Post('terms').meets(Condition.MatchesValue(true))
```

### Chaining in Complex Logic

```typescript
// Clean, readable complex conditions
when(
  and(
    Answer('account_type').match(Condition.MatchesValue('business')),
    Data('features.business').satisfies(Condition.MatchesValue(true)),
    Self().passes(Condition.IsRequired())
  )
).then('Show business features')

// Mixed reference types
when(
  or(
    Params('admin').match(Condition.MatchesValue('true')),
    Data('user.role').match(Condition.In(['admin', 'moderator'])),
    Answer('override_permissions').meets(Condition.Equals(true))
  )
).then('Grant admin access')
```
