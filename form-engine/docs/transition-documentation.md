# Transition Documentation

## Overview
Transitions define how users move through a form journey by controlling what happens
when they interact with a step. They specify validation behavior, side effects
(like saving data), and navigation logic based on user actions and form state.

## Structure
Every transition follows this pattern:

- **Trigger** - What action initiates the transition (optional, runs on any submission)
- **Guards** - Conditions that must be met for the transition to proceed (optional)
- **Validation** - Whether to validate the step's fields
- **Outcomes** - Different paths based on validation results
- **Navigation** - Where to send the user next

### Transition Types
There are 2 types of transitions, validated, and non-validated

#### Validated Transition
Used when you need to ensure data integrity before proceeding. The transition
will validate all fields in the current step and branch based on the validation result.

```typescript
transition({
  when?: PredicateExpr,      // Trigger condition (usually button action)
  guard?: PredicateExpr,     // Access control condition
  validate: boolean,         // Whether to validate fields
  onAlways?: {              // Always executes (before validation)
    effects?: Effect[],
  },
  onValid: {               // Executes if validation passes
    effects?: Effect[],
    next?: Navigation[]
  },
  onInvalid: {             // Executes if validation fails
    effects?: Effect[],
    next?: Navigation[]
  }
})
```

#### Non-validated Transition
Used for actions that don't require validation, such as saving drafts,
navigation without data entry, or collection management operations.
```typescript
transition({
  when?: PredicateExpr,      // Trigger condition (usually button action)
  guard?: PredicateExpr,     // Access control condition
  validate: boolean,         // Whether to validate fields
  onAlways?: {               // Always executes (before validation)
    effects?: Effect[],
    next: Navigation[]
  },
})
```

## Core Properties

### `when` (Optional)
Defines what triggers this transition. Typically matches against form submission
data, especially button actions.

```typescript
// Single action trigger
when: Post('action').match(Condition.MatchesValue('continue'))

// Pattern matching for dynamic actions
when: Post('action').match(Condition.MatchesRegex('^delete-item-(.+)$'))

// Multiple possible triggers
when: or(
  Post('action').match(Condition.MatchesValue('continue')),
  Post('action').match(Condition.MatchesValue('save-and-continue')),
)
```

> [!NOTE]
> When calculating a user's journey path for access control, the `when`
> attribute is not evaluated. This means all transitions are considered as
> possible paths regardless of their trigger conditions.

### `guards` (Optional)
Additional conditions that must be met for the transition to proceed, regardless
of the trigger. Guards act as a security layer to prevent transitions in certain states.

> [!IMPORTANT]
> Make sure to not use submission-time data in the guard (i.e `Post('some-value')`), as
> this will only exist at step submission time and will not when calculating the journey
> traversal path, causing a traversal block.

```typescript
transition({
  when: Post('action').match(Condition.MatchesValue('submit')),
  guards: and(
    Data('user.roles').match(Condition.Contains('write')),
    Data('user.location').match(Condition.MatchesValue('PRISON'))
  ),
  validate: true,
  // ...
})
```

### `validate`
Boolean flag that determines whether to run validation on the step's fields before proceeding.

- `true` - Validates all fields in the current step. The transition will
branch to `onValid` or `onInvalid` based on the result.
- `false` - Skips validation entirely. Only `onAlways` will execute.

### `onAlways` (Optional)
Executes regardless of validation state. When validation is enabled, this runs **before** validation occurs.

```typescript
{
  onAlways: {
    effects: [
      // Update collection data from form submission
      Effect.mapToCollection({
        collection: Answer('addresses'),
        item: [
          { property: 'street', regexMatch: ['^address-(.+)-street$', 1], source: Post() },
        ],
      }),
    ],
      next: [/* Optional navigation that always occurs */]
  }
}
```

### `onValid` / `onInvalid`
Define behavior based on validation results. Only applicable when `validate: true`.

```typescript

onValid: {
  effects: [Effect.save()],
  next: [{ goto: '/success' }]
}
onInvalid: {
  effects: [Effect.save({ draft: true })],
  next: [{ goto: '/current-step' }]  // Typically return to same step to show errors
}

```

## Navigation (`next`)
The `next` property defines where to navigate after the transition. It's an array
of navigation rules evaluated in order.

### Simple Navigation
```typescript
next: [{ goto: '/next-step' }]
```

### Conditional Navigation
Navigate to different places based on form state:

> [!IMPORTANT]
> Make sure to not use submission-time data in the condition (i.e `Post('some-value')`),
> within `next`, as this will cause issues with journey traversal path calculations.

```typescript
next: [
  {
    when: Answer('account_type').match(Condition.Equals('business')),
    goto: '/business-details',
  },
  {
    when: Answer('account_type').match(Condition.Equals('personal')),
    goto: '/personal-details',
  },
  {
    // Default fallback (no when condition)
    goto: '/generic-details',
  },
]
```

### Dynamic Path Parameters
Use template literals or Format expressions for dynamic URLs:

> [!IMPORTANT]
> Any step that has a dynamic URL needs to have disabled journey path transversal checking

```typescript
next: [{ goto: Format('/addresses/%1/edit', Answer('selected_address_id')) }]
```

## Common Patterns

### 1. Standard Form Progression
The most common pattern - validate and move forward on success, stay on failure:

```typescript
transition({
  when: Post('action').match(Condition.MatchesValue('continue')),
  validate: true,
  onValid: {
    effects: [Effect.save()],
    next: [{ goto: '/step-two' }],
  },
  onInvalid: {
    next: [{ goto: '/step-one' }],
  },
})
```

### 2. Branching Based on User Input
Navigate to different paths based on form answers:

```typescript
transition({
  when: Post('action').match(Condition.MatchesValue('continue')),
  validate: true,
  onValid: {
    effects: [Effect.save()],
    next: [
      {
        when: Answer('employment_status').match(Condition.Equals('employed')),
        goto: '/employment-details',
      },
      {
        when: Answer('employment_status').match(Condition.Equals('self-employed')),
        goto: '/self-employed-details',
      },
      {
        when: Answer('employment_status').match(Condition.Equals('unemployed')),
        goto: '/unemployment-details',
      },
    ],
  },
  onInvalid: {
    next: [{ goto: '/employment-status' }],
  },
})
```

### 3. Collection Management
> [!WARNING]
> I'm still trying to figure out a neat way to do Collections,
> specifically the mapping of fields to collection values. Any suggestions would be great.

Handle add/edit/delete operations on collections without validation:

```typescript
// Add item to collection
transition({
  when: Post('action').match(Condition.MatchesValue('add-another')),
  validate: false,
  onAlways: {
    effects: [
      Effect.mapToCollection({ /* map current form data */ }),
      Effect.addToCollection({
        collection: Answer('addresses'),
        item: { street: '', city: '', postcode: '' },
      }),
      Effect.save({ draft: true }),
    ],
    next: [{ goto: '/addresses' }],
  },
}),

// Remove item from collection
transition({
  when: Post('action').match(Condition.MatchesRegex('^delete-(.+)$')),
  validate: false,
  onAlways: {
    effects: [
      Effect.removeFromCollection({
        collection: Answer('addresses'),
        target: Post('action').pipe(
          Transformer.regexCapture('^delete-(.+)$', 1),
          Transformer.toInt()
        ),
      }),
      Effect.save({ draft: true }),
    ],
    next: [{ goto: '/addresses' }],
  },
})
```

### 4. Save as Draft
Allow users to save progress without validation:

```typescript
transition({
  when: Post('action').match(Condition.MatchesValue('save-draft')),
  validate: false,
  onAlways: {
    effects: [Effect.save({ draft: true })],
    next: [{ /** remain on existing step **/ }],
  },
})
```

### 5. Multi-Action Steps
Handle multiple different actions on the same step:

```typescript
step({
  path: '/review',
  blocks: [/* ... */],
  transitions: [
    // Save draft
    transition({
      when: Post('action').match(Condition.MatchesValue('save-draft')),
      validate: false,
      onAlways: {
        effects: [Effect.save({ draft: true })],
        next: [{ goto: '/dashboard' }],
      },
    }),

    // Submit
    transition({
      when: Post('action').match(Condition.MatchesValue('submit')),
      validate: true,
      onValid: {
        effects: [Effect.save(), Effect.submit()],
        next: [{ goto: '/confirmation' }],
      },
      onInvalid: {
        next: [{ goto: '/review' }],
      },
    }),
  ],
})
```

## Execution Order

Understanding the order of execution is crucial for complex transitions:

1. **Trigger Evaluation** - Check if `when` condition matches
2. **Guard Checking** - Evaluate `guards` if present
3. **Always Effects** - Execute `onAlways.effects` if defined
4. **Always Navigation** - Process `onAlways.next` if defined
5. **Validation** - If `validate: true`, validate all step fields
6. **Outcome Effects** - Execute `onValid.effects` or `onInvalid.effects`
7. **Outcome Navigation** - Process `onValid.next` or `onInvalid.next`

## Best Practices

### 1. Order Transitions by Specificity
Place more specific transitions before general ones:

```typescript
transitions: [
  // Specific action first
  transition({
    when: Post('action').match(Condition.MatchesRegex('^delete-item-(.+)$')),
    // ...
  }),
  // General action last
  transition({
    when: Post('action').match(Condition.MatchesValue('continue')),
    // ...
  }),
]
```

### 2. Always Provide Fallback Navigation
Ensure users always have somewhere to go:

```typescript
next: [
  { when: /* condition 1 */, goto: '/path1' },
  { when: /* condition 2 */, goto: '/path2' },
  { goto: '/default-path' },  // No when = always matches
]
```

### 3. Use Guards for Security
Don't rely solely on UI to prevent actions:

```typescript
transition({
  when: Post('action').match(Condition.MatchesValue('delete')),
  guards: Data('user.permissions').match(Condition.Contains('delete')),
  // ...
})
```

### 4. Keep Validation Consistent
If a step has required fields, use `validate: true` for the primary continue action:

```typescript
// Primary action validates
transition({
  when: Post('action').match(Condition.MatchesValue('continue')),
  validate: true,
  // ...
}),
// Secondary actions might skip validation
transition({
  when: Post('action').match(Condition.MatchesValue('save-draft')),
  validate: false,
  // ...
})
```

### 5. Handle Collection Operations Separately
Keep collection management transitions distinct and without validation:

```typescript
transitions: [
  // Collection operations first (no validation)
  transition({ /* add item */ }),
  transition({ /* remove item */ }),
  transition({ /* edit item */ }),

  // Main flow last (with validation)
  transition({ /* continue */ }),
]
```
