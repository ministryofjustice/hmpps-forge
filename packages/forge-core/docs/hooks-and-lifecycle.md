# Hooks and Lifecycle

Forge uses a lifecycle system to control access control, data loading, in-page actions, and form submission. Hooks define what happens at each stage of the request lifecycle.

This enables:
- Controlling access to steps based on conditions
- Loading data from APIs before rendering
- Handling in-page actions like address lookups
- Validating, saving, and navigating on form submission
- Conditional navigation based on user answers

## Hook Types

| Hook | Builder | Where Used | Purpose |
|------|---------|------------|---------|
| **Access** | `access()` | journey, step | Load data, check permissions, redirect or error |
| **Action** | `action()` | step only | Handle in-page actions (lookups, fetches) |
| **Submit** | `submit()` | step only | Validate, save, and navigate |

### Import

```typescript
import {
  // Hook builders
  access,
  action,
  submit,
  // Outcome builders
  redirect,
  throwError,
  // HTTP references (for conditions)
  Post, Params, Query,
} from '@ministryofjustice/hmpps-forge/core/authoring'
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

## `access()` - Access Control and Data Loading

Controls access to journeys and steps, and loads data needed for rendering. The `when` condition determines whether this hook executes.

### Signature

```typescript
access({
  when?: PredicateExpr,           // Execution condition
  effects?: EffectFunctionExpr[], // Effects to run
  next?: [                        // Outcomes (first match wins)
    redirect({ when?, goto }),
    throwError({ when?, status, message }),
  ],
})
```

### Properties

- `when` (Optional): Execution condition. When **true**, this hook **executes**. When omitted, always executes.
- `effects` (Optional): Effects to run when this hook executes
- `next` (Optional): Array of outcomes. First matching outcome wins. Can contain:
  - `redirect({ when?, goto })` - Navigate to a path
  - `throwError({ when?, status, message })` - Return an HTTP error

### Execution Semantics

Access hooks execute sequentially in order:

1. If `when` is present and evaluates to **false**, skip to next hook
2. If `when` is absent or evaluates to **true**, execute this hook:
   - Run all `effects`
   - Evaluate `next` outcomes in order (first match wins)
   - If a redirect or error outcome matches, stop processing
   - Otherwise, continue to next hook
3. After all hooks, render the page

```typescript
// Effects-only: always runs, then continues
access({
  effects: [MyEffects.loadUserProfile()],
})

// Conditional redirect: when true, redirect
access({
  when: Data('user.isAuthenticated').not.match(Condition.Equals(true)),
  next: [redirect({ goto: '/login' })],
})

// Error response: when true, return error
access({
  when: Data('itemNotFound').match(Condition.Equals(true)),
  next: [
    throwError({
      status: 404,
      message: Format('Item %1 was not found', Params('itemId')),
    }),
  ],
})

// Permission denied
access({
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

Use effects-only hooks (no `next`) to load data:

```typescript
onAccess: [
  // Load data first - always executes
  access({
    effects: [MyEffects.loadItem(Params('itemId'))],
  }),

  // Then check access based on loaded data
  access({
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

## `action()` - In-Page Actions

Handles in-page actions like address lookups and data fetches. Runs **before** blocks render, so effect-set values appear immediately.

### Signature

```typescript
action({
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
    GovUKTextInput({
      code: 'postcode',
      label: 'Postcode',
    }),

    GovUKButton({
      text: 'Find address',
      name: 'action',
      value: 'lookup',
      classes: 'govuk-button--secondary',
    }),

    GovUKTextInput({
      code: 'addressLine1',
      label: 'Address line 1',
    }),

    GovUKButton({
      text: 'Continue',
      name: 'action',
      value: 'continue',
    }),
  ],

  onAction: [
    action({
      when: Post('action').match(Condition.Equals('lookup')),
      effects: [MyEffects.lookupPostcode(Post('postcode'))],
    }),
  ],

  onSubmission: [
    submit({
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
- **First-match**: Only the first matching `action()` runs
- **Before render**: Effects execute before blocks render
- **No navigation**: Actions always stay on the current page

---

## `submit()` - Form Submission

Handles form submission, validation, and navigation. The most complex hook type with multiple execution paths.

### Signature

```typescript
submit({
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

- `when` (Optional): Condition to match this hook. If omitted, always matches (use as fallback)
- `guards` (Optional): Permission check. When **true**, hook proceeds
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
submit({
  validate: true,
  onValid: {
    effects: [MyEffects.saveAnswers()],
    next: [redirect({ goto: '/next-step' })],
  },
})
```

**Save draft without validation:**
```typescript
submit({
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
submit({
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
  submit({
    when: Post('action').match(Condition.Equals('saveAndAdd')),
    validate: true,
    onValid: {
      effects: [MyEffects.saveItem()],
      next: [redirect({ goto: '/items/new' })],
    },
  }),

  // Save and return to list
  submit({
    when: Post('action').match(Condition.Equals('save')),
    validate: true,
    onValid: {
      effects: [MyEffects.saveItem()],
      next: [redirect({ goto: '/items' })],
    },
  }),

  // Fallback (no 'when' - catches everything else)
  submit({
    validate: true,
    onValid: {
      next: [redirect({ goto: '/items' })],
    },
  }),
]
```

---

## `redirect()` - Navigation Outcome

Defines navigation destinations. Used in `next` arrays within access hooks and submit hooks (`onValid`/`onInvalid`/`onAlways`).

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

### Error Handling in Submit Hooks

Submit hooks can return errors for save failures or business rule violations:

```typescript
submit({
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

## Journey-Level Hooks

Journey-level hooks run for **every step** in the journey.

```typescript
journey({
  path: '/my-journey',

  // Runs before every step: load data, then check access
  onAccess: [
    // Load shared data first
    access({
      effects: [MyEffects.loadSharedData()],
    }),

    // Then check authentication
    access({
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

### Complete Step with All Hook Types

```typescript
export const businessDetailsStep = step({
  path: '/business-details',
  title: 'Business Details',

  blocks: [
    GovUKTextInput({
      code: 'postcode',
      label: 'Postcode',
    }),
    GovUKButton({
      text: 'Find address',
      name: 'action',
      value: 'lookup',
      classes: 'govuk-button--secondary',
    }),
    GovUKTextInput({
      code: 'addressLine1',
      label: 'Address line 1',
    }),
    GovUKButton({
      text: 'Continue',
    }),
  ],

  // 1. Load data and check access
  onAccess: [
    // Load step-specific data
    access({
      effects: [MyEffects.loadSavedAddress()],
    }),

    // Ensure prerequisite is complete
    access({
      when: Data('businessType').not.match(Condition.IsRequired()),
      next: [redirect({ goto: '/business-type' })],
    }),
  ],

  // 2. Handle lookup button
  onAction: [
    action({
      when: Post('action').match(Condition.Equals('lookup')),
      effects: [MyEffects.lookupPostcode(Post('postcode'))],
    }),
  ],

  // 3. Handle form submission
  onSubmission: [
    submit({
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
    access({
      effects: [MyEffects.loadItem(Params('itemId'))],
    }),

    // 404: Item not found
    access({
      when: Data('itemNotFound').match(Condition.Equals(true)),
      next: [
        throwError({
          status: 404,
          message: Format('Item %1 was not found', Params('itemId')),
        }),
      ],
    }),

    // 403: No edit permission
    access({
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
    submit({
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
  submit({
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

### Always Include Fallback Hooks

```typescript
// DO: Include a fallback
onSubmission: [
  submit({
    when: Post('action').match(Condition.Equals('save')),
    validate: true,
    onValid: { next: [redirect({ goto: '/saved' })] },
  }),
  submit({
    // No 'when' - catches everything else
    validate: true,
    onValid: { next: [redirect({ goto: '/default' })] },
  }),
]

// DON'T: Risk unhandled submissions
onSubmission: [
  submit({
    when: Post('action').match(Condition.Equals('save')),
    validate: true,
    onValid: { next: [redirect({ goto: '/saved' })] },
  }),
  // Missing fallback!
]
```

### Order Hooks Correctly

Specific conditions first, fallbacks last:

```typescript
// DO: Specific first, fallback last
onSubmission: [
  submit({
    when: Post('action').match(Condition.Equals('save')),
    // ...
  }),
  submit({
    when: Post('action').match(Condition.Equals('delete')),
    // ...
  }),
  submit({
    // Fallback last
    validate: true,
    onValid: { next: [redirect({ goto: '/default' })] },
  }),
]

// DON'T: Fallback first catches everything
onSubmission: [
  submit({
    // No 'when' - matches immediately!
    validate: true,
    onValid: { next: [redirect({ goto: '/default' })] },
  }),
  submit({
    when: Post('action').match(Condition.Equals('save')),
    // Never reached!
  }),
]
```

### Use Distinct Action Values

```typescript
// DO: Different values for different buttons
GovUKButton({
  text: 'Find address',
  name: 'action',
  value: 'lookup',  // Distinct value
}),

GovUKButton({
  text: 'Continue',
  name: 'action',
  value: 'continue',  // Distinct value
}),
```

### Load Data Before Access Checks

```typescript
// DO: Load data, then check conditions based on loaded data
onAccess: [
  access({
    effects: [MyEffects.loadItem(Params('itemId'))],
  }),
  access({
    when: Data('itemNotFound').match(Condition.Equals(true)),
    next: [throwError({ status: 404, message: 'Item not found' })],
  }),
]

// DON'T: Try to check data that hasn't been loaded yet
onAccess: [
  access({
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
