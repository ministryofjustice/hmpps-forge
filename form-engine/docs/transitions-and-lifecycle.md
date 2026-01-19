# Transitions and Lifecycle

The form-engine uses a lifecycle system to control access control, data loading, in-page actions, and form submission. Transitions define what happens at each stage of the request lifecycle.

This enables:
- Controlling access to steps based on conditions
- Loading data from APIs before rendering
- Handling in-page actions like address lookups
- Validating, saving, and navigating on form submission
- Conditional navigation based on user answers

## Transition Types

| Transition | Builder | Where Used | Purpose |
|------------|---------|------------|---------|
| **Access** | `accessTransition()` | journey, step | Load data, check permissions, redirect or error |
| **Action** | `actionTransition()` | step only | Handle in-page actions (lookups, fetches) |
| **Submit** | `submitTransition()` | step only | Validate, save, and navigate |

### Import

```typescript
import {
  // Transition builders
  accessTransition,
  actionTransition,
  submitTransition,
  // Outcome builders
  redirect,
  throwError,
  // HTTP references (for conditions)
  Post, Params, Query,
} from '@form-engine/form/builders'
```

---

## Request Lifecycle

### GET Request (Viewing a Page)

```
Journey.onAccess   → Load shared data, check journey-level permissions
Step.onAccess      → Load step-specific data, check step-level permissions
Blocks render      → Display the page
```

### POST Request (Submitting a Form)

```
Step.onAccess      → Load data, check permissions
Step.onAction      → Handle in-page actions (runs BEFORE render)
Blocks render      → Display with action results
Step.onSubmission  → Validate and navigate
```

### Execution Semantics

Different lifecycle hooks execute differently:

| Hook | Execution | Reason |
|------|-----------|--------|
| `onAccess[]` | **Sequential** | Execute effects, first redirect/status stops |
| `onAction[]` | **First match** | One action handles each button |
| `onSubmission[]` | **First match** | One handler per submission |

---

## `accessTransition()` - Access Control and Data Loading

Controls access to journeys and steps, and loads data needed for rendering. The `when` condition determines whether this transition executes.

### Signature

```typescript
accessTransition({
  when?: PredicateExpr,           // Execution condition
  effects?: EffectFunctionExpr[], // Effects to run
  next?: [                        // Outcomes (first match wins)
    redirect({ when?, goto }),
    throwError({ when?, status, message }),
  ],
})
```

### Properties

- `when` (Optional): Execution condition. When **true**, this transition **executes**. When omitted, always executes.
- `effects` (Optional): Effects to run when this transition executes
- `next` (Optional): Array of outcomes. First matching outcome wins. Can contain:
  - `redirect({ when?, goto })` - Navigate to a path
  - `throwError({ when?, status, message })` - Return an HTTP error

### Execution Semantics

Access transitions execute sequentially in order:

1. If `when` is present and evaluates to **false**, skip to next transition
2. If `when` is absent or evaluates to **true**, execute this transition:
   - Run all `effects`
   - Evaluate `next` outcomes in order (first match wins)
   - If a redirect or error outcome matches, stop processing
   - Otherwise, continue to next transition
3. After all transitions, render the page

```typescript
// Effects-only: always runs, then continues
accessTransition({
  effects: [MyEffects.loadUserProfile()],
})

// Conditional redirect: when true, redirect
accessTransition({
  when: Data('user.isAuthenticated').not.match(Condition.Equals(true)),
  next: [redirect({ goto: '/login' })],
})

// Error response: when true, return error
accessTransition({
  when: Data('itemNotFound').match(Condition.Equals(true)),
  next: [
    throwError({
      status: 404,
      message: Format('Item %1 was not found', Params('itemId')),
    }),
  ],
})

// Permission denied
accessTransition({
  when: Data('item.canEdit').not.match(Condition.Equals(true)),
  next: [
    throwError({
      status: 403,
      message: 'You do not have permission to edit this item',
    }),
  ],
})
```

### Data Loading Pattern

Use effects-only transitions (no `next`) to load data:

```typescript
onAccess: [
  // Load data first - always executes
  accessTransition({
    effects: [MyEffects.loadItem(Params('itemId'))],
  }),

  // Then check access based on loaded data
  accessTransition({
    when: Data('itemNotFound').match(Condition.Equals(true)),
    next: [throwError({ status: 404, message: 'Item not found' })],
  }),
]
```

### When to Use Each Outcome

| Use Effects-Only When | Use `redirect()` When | Use `throwError()` When |
|-----------------------|-----------------------|-------------------------|
| Loading data for rendering | User needs to complete a prerequisite | Resource doesn't exist (404) |
| Pre-populating form fields | User needs to log in | User lacks permission (403) |
| Initializing shared state | Workflow requires a different path | Server-side error (500) |

---

## `actionTransition()` - In-Page Actions

Handles in-page actions like address lookups and data fetches. Runs **before** blocks render, so effect-set values appear immediately.

### Signature

```typescript
actionTransition({
  when: PredicateExpr,            // Required: trigger condition
  effects: EffectFunctionExpr[],  // Required: effects to execute
})
```

### Properties

- `when` (Required): Trigger condition. Typically matches a button's `name` and `value` using `Post()`
- `effects` (Required): Array of effect functions to execute

### Why Actions Run Before Render

The key insight: actions run before blocks render, so lookup results appear immediately.

```
POST with action=lookup
    ↓
onAction evaluated → Effect sets address fields
    ↓
Blocks render → Address fields show lookup results
    ↓
onSubmission NOT run (different action)
```

### Usage

```typescript
step({
  blocks: [
    field<GovUKTextInput>({
      variant: 'govukTextInput',
      code: 'postcode',
      label: 'Postcode',
    }),

    block<GovUKButton>({
      variant: 'govukButton',
      text: 'Find address',
      name: 'action',
      value: 'lookup',
      classes: 'govuk-button--secondary',
    }),

    field<GovUKTextInput>({
      variant: 'govukTextInput',
      code: 'addressLine1',
      label: 'Address line 1',
    }),

    block<GovUKButton>({
      variant: 'govukButton',
      text: 'Continue',
      name: 'action',
      value: 'continue',
    }),
  ],

  onAction: [
    actionTransition({
      when: Post('action').match(Condition.Equals('lookup')),
      effects: [MyEffects.lookupPostcode(Post('postcode'))],
    }),
  ],

  onSubmission: [
    submitTransition({
      when: Post('action').match(Condition.Equals('continue')),
      validate: true,
      onValid: {
        effects: [MyEffects.saveAddress()],
        next: [redirect({ goto: '/next-step' })],
      },
    }),
  ],
})
```

### Key Characteristics

- **Step-level only**: Not available on journeys
- **First-match**: Only the first matching `actionTransition` runs
- **Before render**: Effects execute before blocks render
- **No navigation**: Actions always stay on the current page

---

## `submitTransition()` - Form Submission

Handles form submission, validation, and navigation. The most complex transition type with multiple execution paths.

### Signature

```typescript
submitTransition({
  when?: PredicateExpr,     // Which button triggered
  guards?: PredicateExpr,   // Permission check (true = proceed)
  validate?: boolean,       // Show validation errors?
  onAlways?: {              // Always runs
    effects?: EffectFunctionExpr[],
    next?: [redirect(), throwError()],  // Outcomes (first match wins)
  },
  onValid?: {               // Only if validation passes
    effects?: EffectFunctionExpr[],
    next?: [redirect(), throwError()],  // Outcomes (first match wins)
  },
  onInvalid?: {             // Only if validation fails
    effects?: EffectFunctionExpr[],
    next?: [redirect(), throwError()],  // Outcomes (first match wins)
  },
})
```

### Properties

- `when` (Optional): Condition to match this transition. If omitted, always matches (use as fallback)
- `guards` (Optional): Permission check. When **true**, transition proceeds
- `validate` (Optional): Whether to show validation errors. Defaults to `false`
- `onAlways` (Optional): Runs regardless of validation result
- `onValid` (Optional): Runs only if validation passes
- `onInvalid` (Optional): Runs only if validation fails

### Validation Behaviour

Validation always runs internally. The `validate` property controls whether errors are **shown** and which paths are **available**:

| `validate` | Error Messages | Available Paths |
|------------|----------------|-----------------|
| `true` | Visible to user | `onValid`, `onInvalid`, `onAlways` |
| `false` | Hidden | `onAlways` only |

### Basic Patterns

**Validate and continue:**
```typescript
submitTransition({
  validate: true,
  onValid: {
    effects: [MyEffects.saveAnswers()],
    next: [redirect({ goto: '/next-step' })],
  },
})
```

**Save draft without validation:**
```typescript
submitTransition({
  when: Post('action').match(Condition.Equals('saveDraft')),
  validate: false,
  onAlways: {
    effects: [MyEffects.saveDraft()],
    next: [redirect({ goto: '/dashboard' })],
  },
})
```

**Stay on step when invalid:**
```typescript
submitTransition({
  validate: true,
  onValid: {
    effects: [MyEffects.saveAnswers()],
    next: [redirect({ goto: '/next-step' })],
  },
  onInvalid: {
    effects: [MyEffects.logValidationFailure()],
    // Omit 'next' to stay on current step
  },
})
```

### Multiple Submit Buttons

```typescript
onSubmission: [
  // Save and add another
  submitTransition({
    when: Post('action').match(Condition.Equals('saveAndAdd')),
    validate: true,
    onValid: {
      effects: [MyEffects.saveItem()],
      next: [redirect({ goto: '/items/new' })],
    },
  }),

  // Save and return to list
  submitTransition({
    when: Post('action').match(Condition.Equals('save')),
    validate: true,
    onValid: {
      effects: [MyEffects.saveItem()],
      next: [redirect({ goto: '/items' })],
    },
  }),

  // Fallback (no 'when' - catches everything else)
  submitTransition({
    validate: true,
    onValid: {
      next: [redirect({ goto: '/items' })],
    },
  }),
]
```

---

## `redirect()` - Navigation Outcome

Defines navigation destinations. Used in `next` arrays within access transitions and submit transitions (`onValid`/`onInvalid`/`onAlways`).

### Signature

```typescript
redirect({
  when?: PredicateExpr,        // Condition for this destination
  goto: string | FormatExpr,   // Destination path
})
```

### Properties

- `when` (Optional): Condition that must be true for this navigation. If omitted, always applies (use as fallback)
- `goto` (Required): Destination path. Accepts **strings** or **Format()** expressions only

### Static Navigation

```typescript
redirect({ goto: 'next-step' })           // Relative path
redirect({ goto: '/absolute/path' })      // Absolute path
```

### Dynamic Navigation

```typescript
// Using Format() for dynamic paths
redirect({ goto: Format('/items/%1/edit', Answer('itemId')) })
redirect({ goto: Format('/users/%1/profile', Params('userId')) })
```

### Conditional Navigation

Multiple `redirect()` entries are evaluated in order. The first match wins:

```typescript
onValid: {
  effects: [MyEffects.saveAnswers()],
  next: [
    // Specific conditions first
    redirect({
      when: Answer('userType').match(Condition.Equals('business')),
      goto: '/business-details',
    }),
    redirect({
      when: Answer('userType').match(Condition.Equals('individual')),
      goto: '/individual-details',
    }),
    // Fallback last (no 'when')
    redirect({ goto: '/generic-details' }),
  ],
}
```

### Staying on Current Step

To stay on the current step, **omit the `next` array entirely**:

```typescript
onInvalid: {
  effects: [MyEffects.saveDraft()],
  // No 'next' - stays on current step
}
```

> **Important:** `goto` does NOT accept `Conditional()` or `when().then().else()`. Use multiple `redirect()` entries with `when` conditions instead.

---

## `throwError()` - Error Outcome

Returns an HTTP error response. Used in `next` arrays to handle error conditions like missing resources or permission denied.

### Signature

```typescript
throwError({
  when?: PredicateExpr,        // Condition for this error
  status: number,              // HTTP status code (400, 403, 404, 500, etc.)
  message: string | FormatExpr, // Error message
})
```

### Properties

- `when` (Optional): Condition that must be true for this error to trigger. If omitted, always triggers (use as fallback)
- `status` (Required): HTTP status code
- `message` (Required): Error message. Accepts **strings** or **Format()** expressions

### Common Status Codes

| Code | Meaning | Use When |
|------|---------|----------|
| 400 | Bad Request | Invalid input that can't be processed |
| 403 | Forbidden | User lacks permission |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Business rule violation (e.g., duplicate) |
| 500 | Server Error | Unexpected server-side failure |

### Examples

```typescript
// Simple error
throwError({ status: 404, message: 'Item not found' })

// Dynamic error message
throwError({
  status: 404,
  message: Format('Item %1 was not found', Params('itemId')),
})

// Conditional error
throwError({
  when: Data('saveError').match(Condition.IsRequired()),
  status: 500,
  message: Format('Failed to save: %1', Data('saveError')),
})
```

### Error Handling in Submit Transitions

Submit transitions can return errors for save failures or business rule violations:

```typescript
submitTransition({
  validate: true,
  onValid: {
    effects: [MyEffects.saveGoal()],
    next: [
      // Handle save failure
      throwError({
        when: Data('saveError').match(Condition.IsRequired()),
        status: 500,
        message: Format('Failed to save goal: %1', Data('saveError')),
      }),
      // Handle business rule violation
      throwError({
        when: Data('duplicateGoal').match(Condition.Equals(true)),
        status: 409,
        message: 'This goal already exists',
      }),
      // Success - redirect
      redirect({ goto: '/goals/overview' }),
    ],
  },
})
```

---

## Journey-Level Transitions

Journey-level transitions run for **every step** in the journey.

```typescript
journey({
  path: '/my-journey',

  // Runs before every step: load data, then check access
  onAccess: [
    // Load shared data first
    accessTransition({
      effects: [MyEffects.loadSharedData()],
    }),

    // Then check authentication
    accessTransition({
      when: Data('user.isAuthenticated').not.match(Condition.Equals(true)),
      next: [redirect({ goto: '/login' })],
    }),
  ],

  steps: [/* ... */],
})
```

### When to Use Journey vs Step Level

| Scope | Use Journey-Level | Use Step-Level |
|-------|-------------------|----------------|
| Data loading | Shared data needed by all steps | Step-specific data |
| Access control | Authentication, global permissions | Step-specific permissions |
| Actions | N/A (not available) | All in-page actions |
| Submission | N/A (not available) | All form submissions |

---

## Common Patterns

### Complete Step with All Transition Types

```typescript
export const businessDetailsStep = step({
  path: '/business-details',
  title: 'Business Details',

  blocks: [
    field<GovUKTextInput>({
      variant: 'govukTextInput',
      code: 'postcode',
      label: 'Postcode',
    }),
    block<GovUKButton>({
      variant: 'govukButton',
      text: 'Find address',
      name: 'action',
      value: 'lookup',
      classes: 'govuk-button--secondary',
    }),
    field<GovUKTextInput>({
      variant: 'govukTextInput',
      code: 'addressLine1',
      label: 'Address line 1',
    }),
    block<GovUKButton>({
      variant: 'govukButton',
      text: 'Continue',
    }),
  ],

  // 1. Load data and check access
  onAccess: [
    // Load step-specific data
    accessTransition({
      effects: [MyEffects.loadSavedAddress()],
    }),

    // Ensure prerequisite is complete
    accessTransition({
      when: Data('businessType').not.match(Condition.IsRequired()),
      next: [redirect({ goto: '/business-type' })],
    }),
  ],

  // 2. Handle lookup button
  onAction: [
    actionTransition({
      when: Post('action').match(Condition.Equals('lookup')),
      effects: [MyEffects.lookupPostcode(Post('postcode'))],
    }),
  ],

  // 3. Handle form submission
  onSubmission: [
    submitTransition({
      validate: true,
      onValid: {
        effects: [MyEffects.saveStepAnswers()],
        next: [redirect({ goto: '/operator-details' })],
      },
    }),
  ],
})
```

### Edit Page with Access Checks

```typescript
step({
  path: '/edit/:itemId',
  title: 'Edit Item',

  onAccess: [
    // Load item data first
    accessTransition({
      effects: [MyEffects.loadItem(Params('itemId'))],
    }),

    // 404: Item not found
    accessTransition({
      when: Data('itemNotFound').match(Condition.Equals(true)),
      next: [
        throwError({
          status: 404,
          message: Format('Item %1 was not found', Params('itemId')),
        }),
      ],
    }),

    // 403: No edit permission
    accessTransition({
      when: Data('item.canEdit').not.match(Condition.Equals(true)),
      next: [
        throwError({
          status: 403,
          message: 'You do not have permission to edit this item',
        }),
      ],
    }),
  ],

  blocks: [/* ... */],

  onSubmission: [
    submitTransition({
      validate: true,
      onValid: {
        effects: [MyEffects.updateItem(Params('itemId'))],
        next: [redirect({ goto: Format('/items/%1', Params('itemId')) })],
      },
    }),
  ],
})
```

### Wizard Flow with Conditional Branching

```typescript
onSubmission: [
  submitTransition({
    validate: true,
    onValid: {
      effects: [MyEffects.saveAnswers()],
      next: [
        redirect({
          when: Answer('hasChildren').match(Condition.Equals('yes')),
          goto: '/children-details',
        }),
        redirect({
          when: Answer('hasPartner').match(Condition.Equals('yes')),
          goto: '/partner-details',
        }),
        redirect({ goto: '/summary' }),
      ],
    },
  }),
]
```

---

## Best Practices

### Always Include Fallback Transitions

```typescript
// DO: Include a fallback
onSubmission: [
  submitTransition({
    when: Post('action').match(Condition.Equals('save')),
    validate: true,
    onValid: { next: [redirect({ goto: '/saved' })] },
  }),
  submitTransition({
    // No 'when' - catches everything else
    validate: true,
    onValid: { next: [redirect({ goto: '/default' })] },
  }),
]

// DON'T: Risk unhandled submissions
onSubmission: [
  submitTransition({
    when: Post('action').match(Condition.Equals('save')),
    validate: true,
    onValid: { next: [redirect({ goto: '/saved' })] },
  }),
  // Missing fallback!
]
```

### Order Transitions Correctly

Specific conditions first, fallbacks last:

```typescript
// DO: Specific first, fallback last
onSubmission: [
  submitTransition({
    when: Post('action').match(Condition.Equals('save')),
    // ...
  }),
  submitTransition({
    when: Post('action').match(Condition.Equals('delete')),
    // ...
  }),
  submitTransition({
    // Fallback last
    validate: true,
    onValid: { next: [redirect({ goto: '/default' })] },
  }),
]

// DON'T: Fallback first catches everything
onSubmission: [
  submitTransition({
    // No 'when' - matches immediately!
    validate: true,
    onValid: { next: [redirect({ goto: '/default' })] },
  }),
  submitTransition({
    when: Post('action').match(Condition.Equals('save')),
    // Never reached!
  }),
]
```

### Use Distinct Action Values

```typescript
// DO: Different values for different buttons
block<GovUKButton>({
  variant: 'govukButton',
  text: 'Find address',
  name: 'action',
  value: 'lookup',  // Distinct value
}),

block<GovUKButton>({
  variant: 'govukButton',
  text: 'Continue',
  name: 'action',
  value: 'continue',  // Distinct value
}),
```

### Load Data Before Access Checks

```typescript
// DO: Load data, then check conditions based on loaded data
onAccess: [
  accessTransition({
    effects: [MyEffects.loadItem(Params('itemId'))],
  }),
  accessTransition({
    when: Data('itemNotFound').match(Condition.Equals(true)),
    next: [throwError({ status: 404, message: 'Item not found' })],
  }),
]

// DON'T: Try to check data that hasn't been loaded yet
onAccess: [
  accessTransition({
    when: Data('itemNotFound').match(Condition.Equals(true)),  // Data doesn't exist yet!
    next: [throwError({ status: 404, message: 'Item not found' })],
  }),
]
```

---

## Related Topics

- [References and Chaining](references-and-chaining.md) - `Post()`, `Params()`, `Query()` references
- [Logic and Expressions](logic-and-expressions.md) - Predicate expressions for `when` conditions
- [Validation System](validation-system.md) - Field validation rules
