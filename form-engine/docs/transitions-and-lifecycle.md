# Transitions and Lifecycle

The form-engine uses a lifecycle system to control data loading, access control, in-page actions, and form submission. Transitions define what happens at each stage of the request lifecycle.

This enables:
- Loading data from APIs before rendering
- Controlling access to steps based on conditions
- Handling in-page actions like address lookups
- Validating, saving, and navigating on form submission
- Conditional navigation based on user answers

## Transition Types

| Transition | Builder | Where Used | Purpose |
|------------|---------|------------|---------|
| **Load** | `loadTransition()` | journey, step | Load data before access checks |
| **Access** | `accessTransition()` | journey, step | Check permissions, redirect or error if denied |
| **Action** | `actionTransition()` | step only | Handle in-page actions (lookups, fetches) |
| **Submit** | `submitTransition()` | step only | Validate, save, and navigate |

### Import

```typescript
import {
  // Transition builders
  loadTransition,
  accessTransition,
  actionTransition,
  submitTransition,
  // Navigation builder
  next,
  // HTTP references (for conditions)
  Post, Params, Query,
} from '@form-engine/form/builders'
```

---

## Request Lifecycle

### GET Request (Viewing a Page)

```
Journey.onLoad     → Load shared data
Journey.onAccess   → Check journey-level permissions
Step.onLoad        → Load step-specific data
Step.onAccess      → Check step-level permissions
Blocks render      → Display the page
```

### POST Request (Submitting a Form)

```
Step.onLoad        → Load step data
Step.onAccess      → Check permissions
Step.onAction      → Handle in-page actions (runs BEFORE render)
Blocks render      → Display with action results
Step.onSubmission  → Validate and navigate
```

### Execution Semantics

Different lifecycle hooks execute differently:

| Hook | Execution | Reason |
|------|-----------|--------|
| `onLoad[]` | **ALL** execute | Load multiple data sources |
| `onAccess[]` | **First match** | First denial triggers redirect |
| `onAction[]` | **First match** | One action handles each button |
| `onSubmission[]` | **First match** | One handler per submission |

---

## `loadTransition()` - Data Loading

Loads data before access checks run. Use for API calls, database lookups, and configuration loading.

### Signature

```typescript
loadTransition({
  effects: EffectFunctionExpr[],  // Required: effects to execute
})
```

### Properties

- `effects` (Required): Array of effect functions. All effects execute sequentially in order.

### Usage

```typescript
// Journey-level: load data needed across all steps
journey({
  onLoad: [
    loadTransition({
      effects: [MyEffects.loadUserProfile()],
    }),
    loadTransition({
      effects: [MyEffects.loadAssessmentData()],
    }),
  ],
  steps: [/* ... */],
})

// Step-level: load data specific to this step
step({
  onLoad: [
    loadTransition({
      effects: [MyEffects.loadItem(Params('itemId'))],
    }),
  ],
  blocks: [/* ... */],
})
```

### Key Characteristics

- **All execute**: Every `loadTransition` in the array runs
- **No conditions**: Load transitions don't have `when` or `guards`
- **Order matters**: Effects execute in array order, sequentially
- **Set data and answers**: Effects use `context.setData()` for supplementary data and `context.setAnswer()` to pre-populate fields

---

## `accessTransition()` - Access Control

Controls access to journeys and steps. Guards define **denial conditions** - when the guard is true, access is denied.

### Signature

```typescript
// Redirect variant
accessTransition({
  guards?: PredicateExpr,         // Denial condition
  effects?: EffectFunctionExpr[], // Run before redirect
  redirect: NextExpr[],           // Where to go when denied
})

// Error variant
accessTransition({
  guards?: PredicateExpr,         // Denial condition
  effects?: EffectFunctionExpr[], // Run before error
  status: number,                 // HTTP status code
  message: string | ValueExpr,    // Error message
})
```

### Properties

**Shared (both variants):**
- `guards` (Optional): Denial condition. When **true**, access is **denied**
- `effects` (Optional): Effects to run when access is denied (before redirect/error)

**Redirect variant:**
- `redirect` (Required): Array of `next()` destinations

**Error variant:**
- `status` (Required): HTTP status code (401, 403, 404, etc.)
- `message` (Required): Error message to display

### Guard Semantics

Guards define **denial conditions**:

- `guards` evaluates to **true** → access **denied** → redirect or error
- `guards` evaluates to **false** → continue (check next transition or grant access)
- No matching guards → access granted

```typescript
// Redirect unauthenticated users
accessTransition({
  guards: Data('user.isAuthenticated').not.match(Condition.Equals(true)),
  redirect: [next({ goto: '/login' })],
})

// Return 404 for missing items
accessTransition({
  guards: Data('itemNotFound').match(Condition.Equals(true)),
  status: 404,
  message: Format('Item %1 was not found', Params('itemId')),
})

// Return 403 for permission denied
accessTransition({
  guards: Data('item.canEdit').not.match(Condition.Equals(true)),
  status: 403,
  message: 'You do not have permission to edit this item',
})
```

### When to Use Each Variant

| Use Redirect When | Use Error When |
|-------------------|----------------|
| User needs to complete a prerequisite | Resource doesn't exist (404) |
| User needs to log in | User lacks permission (403) |
| Workflow requires a different path | Server-side error (500) |

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
        next: [next({ goto: '/next-step' })],
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
    next?: NextExpr[],
  },
  onValid?: {               // Only if validation passes
    effects?: EffectFunctionExpr[],
    next?: NextExpr[],
  },
  onInvalid?: {             // Only if validation fails
    effects?: EffectFunctionExpr[],
    next?: NextExpr[],
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
    next: [next({ goto: '/next-step' })],
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
    next: [next({ goto: '/dashboard' })],
  },
})
```

**Stay on step when invalid:**
```typescript
submitTransition({
  validate: true,
  onValid: {
    effects: [MyEffects.saveAnswers()],
    next: [next({ goto: '/next-step' })],
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
      next: [next({ goto: '/items/new' })],
    },
  }),

  // Save and return to list
  submitTransition({
    when: Post('action').match(Condition.Equals('save')),
    validate: true,
    onValid: {
      effects: [MyEffects.saveItem()],
      next: [next({ goto: '/items' })],
    },
  }),

  // Fallback (no 'when' - catches everything else)
  submitTransition({
    validate: true,
    onValid: {
      next: [next({ goto: '/items' })],
    },
  }),
]
```

---

## `next()` - Navigation

Defines navigation destinations. Used in `redirect` arrays and `onValid`/`onInvalid`/`onAlways` next arrays.

### Signature

```typescript
next({
  when?: PredicateExpr,        // Condition for this destination
  goto: string | FormatExpr,   // Destination path
})
```

### Properties

- `when` (Optional): Condition that must be true for this navigation. If omitted, always applies (use as fallback)
- `goto` (Required): Destination path. Accepts **strings** or **Format()** expressions only

### Static Navigation

```typescript
next({ goto: 'next-step' })           // Relative path
next({ goto: '/absolute/path' })      // Absolute path
```

### Dynamic Navigation

```typescript
// Using Format() for dynamic paths
next({ goto: Format('/items/%1/edit', Answer('itemId')) })
next({ goto: Format('/users/%1/profile', Params('userId')) })
```

### Conditional Navigation

Multiple `next()` entries are evaluated in order. The first match wins:

```typescript
onValid: {
  effects: [MyEffects.saveAnswers()],
  next: [
    // Specific conditions first
    next({
      when: Answer('userType').match(Condition.Equals('business')),
      goto: '/business-details',
    }),
    next({
      when: Answer('userType').match(Condition.Equals('individual')),
      goto: '/individual-details',
    }),
    // Fallback last (no 'when')
    next({ goto: '/generic-details' }),
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

> **Important:** `goto` does NOT accept `Conditional()` or `when().then().else()`. Use multiple `next()` entries with `when` conditions instead.

---

## Journey-Level Transitions

Journey-level transitions run for **every step** in the journey.

```typescript
journey({
  path: '/my-journey',

  // Runs before every step
  onLoad: [
    loadTransition({
      effects: [MyEffects.loadSharedData()],
    }),
  ],

  // Checked before every step
  onAccess: [
    accessTransition({
      guards: Data('user.isAuthenticated').not.match(Condition.Equals(true)),
      redirect: [next({ goto: '/login' })],
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

  // 1. Load step-specific data
  onLoad: [
    loadTransition({
      effects: [MyEffects.loadSavedAddress()],
    }),
  ],

  // 2. Check step access
  onAccess: [
    accessTransition({
      guards: Data('businessType').not.match(Condition.IsRequired()),
      redirect: [next({ goto: '/business-type' })],
    }),
  ],

  // 3. Handle lookup button
  onAction: [
    actionTransition({
      when: Post('action').match(Condition.Equals('lookup')),
      effects: [MyEffects.lookupPostcode(Post('postcode'))],
    }),
  ],

  // 4. Handle form submission
  onSubmission: [
    submitTransition({
      validate: true,
      onValid: {
        effects: [MyEffects.saveStepAnswers()],
        next: [next({ goto: '/operator-details' })],
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

  onLoad: [
    loadTransition({
      effects: [MyEffects.loadItem(Params('itemId'))],
    }),
  ],

  onAccess: [
    // 404: Item not found
    accessTransition({
      guards: Data('itemNotFound').match(Condition.Equals(true)),
      status: 404,
      message: Format('Item %1 was not found', Params('itemId')),
    }),

    // 403: No edit permission
    accessTransition({
      guards: Data('item.canEdit').not.match(Condition.Equals(true)),
      status: 403,
      message: 'You do not have permission to edit this item',
    }),
  ],

  blocks: [/* ... */],

  onSubmission: [
    submitTransition({
      validate: true,
      onValid: {
        effects: [MyEffects.updateItem(Params('itemId'))],
        next: [next({ goto: Format('/items/%1', Params('itemId')) })],
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
        next({
          when: Answer('hasChildren').match(Condition.Equals('yes')),
          goto: '/children-details',
        }),
        next({
          when: Answer('hasPartner').match(Condition.Equals('yes')),
          goto: '/partner-details',
        }),
        next({ goto: '/summary' }),
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
    onValid: { next: [next({ goto: '/saved' })] },
  }),
  submitTransition({
    // No 'when' - catches everything else
    validate: true,
    onValid: { next: [next({ goto: '/default' })] },
  }),
]

// DON'T: Risk unhandled submissions
onSubmission: [
  submitTransition({
    when: Post('action').match(Condition.Equals('save')),
    validate: true,
    onValid: { next: [next({ goto: '/saved' })] },
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
    onValid: { next: [next({ goto: '/default' })] },
  }),
]

// DON'T: Fallback first catches everything
onSubmission: [
  submitTransition({
    // No 'when' - matches immediately!
    validate: true,
    onValid: { next: [next({ goto: '/default' })] },
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

### Understand Guard Semantics

```typescript
// accessTransition: guards = true means DENY
accessTransition({
  guards: Data('user.isAuthenticated').not.match(Condition.Equals(true)),
  // When NOT authenticated (true) → deny → redirect
  redirect: [next({ goto: '/login' })],
})

// submitTransition: guards = true means PROCEED
submitTransition({
  guards: Data('user.canSubmit').match(Condition.Equals(true)),
  // When CAN submit (true) → proceed with submission
  validate: true,
  onValid: { /* ... */ },
})
```

---

## Related Topics

- [References and Chaining](references-and-chaining.md) - `Post()`, `Params()`, `Query()` references
- [Logic and Expressions](logic-and-expressions.md) - Predicate expressions for `when` and `guards`
- [Validation System](validation-system.md) - Field validation rules
