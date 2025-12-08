# Lifecycle and Transitions Documentation

## Overview

The form engine uses a comprehensive lifecycle system to manage how users move through forms.
This system provides clear separation of concerns through distinct hooks that handle data loading, access control, and form submissions.
Each hook serves a specific purpose in the form's lifecycle, ensuring predictable behavior and maintainable code.

## The Lifecycle Flow

Understanding the execution order is crucial for building forms correctly:

```
GET Request:
1. Journey onLoad     - Load foundational data (user, permissions, settings)
2. Journey onAccess   - Check journey-level access, track analytics
3. Step onLoad        - Load step-specific data (drafts, section data)
4. Step onAccess      - Check step-level guards, track progress
5. Blocks render      - UI renders with all loaded data available

POST Request (adds):
6. Step onAction      - Handle in-page actions (e.g., postcode lookup)
7. Blocks render      - UI re-renders with action results
8. Step onSubmission  - Handle form submission, validation, navigation
```

This strict order ensures that:
- Data is available when guards need it
- Access control happens before rendering
- Form state is consistent throughout the lifecycle

## The Lifecycle Hooks

### 1. onLoad - Data Loading

**Purpose**: Load data needed for the journey or step
**When it runs**: Before access control checks
**Can include**: Effects only (no guards, as the data they'd check isn't loaded yet)

```typescript
interface LoadTransition {
  effects: EffectFunctionExpr[]  // Required - must load something
}
```

**Usage:**
```typescript
// Journey-level data loading
journey({
  code: 'assessment',
  onLoad: [loadTransition({
    effects: [
      Effect.LoadAssessment(Params('id'))
    ]
  })],
  // ...
})

// Step-level data loading
step({
  path: '/accommodation',
  onLoad: [loadTransition({
    effects: [
      Effect.LoadRiskScores('accommodation'),
      Effect.LoadReferenceData('accommodation-types')
    ]
  })],
  // ...
})
```

**Key Points:**
- Journey `onLoad` runs once when the journey is accessed
- Step `onLoad` runs each time the step is accessed
- Data loaded here becomes available via `Data()` or `Answer()` references
- Effects should populate the context for use in guards and blocks

### 2. onAccess - Access Control

**Purpose**: Check permissions and track access
**When it runs**: After data loading, before rendering
**Can include**: Guards, effects, and navigation

```typescript
interface AccessTransition {
  guards?: PredicateExpr          // Access control conditions
  effects?: EffectFunctionExpr[]  // Analytics, logging, etc.
  redirect?: NextExpr[]               // Where to go if guards fail
}
```

**Usage:**
```typescript
// Journey-level access control
journey({
  onAccess: [accessTransition({
    guards: and(
      Data('user.authenticated').match(Condition.Equals(true)),
      Data('user.hasPermission').match(Condition.Equals(true))
    ),
    effects: [Analytics.TrackJourneyStart()],
    redirect: [{ goto: '/unauthorized' }]  // Redirect if guards fail
  })],
  // ...
})

// Step-level progressive disclosure
step({
  path: '/step-2',
  onAccess: [accessTransition({
    guards: Answer('step_1_complete').match(Condition.Equals(true)),
    redirect: [{ goto: '/step-1' }]  // Must complete step 1 first
  })],
  // ...
})
```

**Key Points:**
- Guards can reference data loaded in `onLoad`
- If guards fail, navigation in `redirect` is triggered

### 3. onAction - In-Page Actions

**Purpose**: Handle in-page actions that need to modify answers before blocks render
**When it runs**: On POST requests, after access control, before block evaluation
**Can include**: Trigger condition and effects
**Step-level only**: Not available on Journey nodes

```typescript
interface ActionTransition {
  when: PredicateExpr           // Required - trigger condition (e.g., button click)
  effects: EffectFunctionExpr[] // Required - effects to run when triggered
}
```

**The Problem it Solves:**

When a form has "in-page actions" (like a "Find address" button), effects that modify answers
need to run BEFORE blocks evaluate. Without `onAction`, effects in `onSubmission` run AFTER
block evaluation, meaning effect-set values (like `addressLine1`) would be lost.

**Usage:**
```typescript
step({
  path: '/business-details',

  onAction: [
    actionTransition({
      when: Post('lookupAddress').match(Condition.Equals('lookup')),
      effects: [Effect.LookupPostcode(Answer('postcode'))],
    }),
  ],

  onSubmission: [
    submitTransition({
      when: Post('action').match(Condition.Equals('continue')),
      validate: true,
      onValid: {
        effects: [Effect.Save()],
        next: [{ goto: '/next-step' }],
      },
    }),
  ],

  blocks: [
    // These fields will show the address populated by the lookup
    field({ code: 'postcode', component: 'TextInput' }),
    field({ code: 'addressLine1', component: 'TextInput' }),
    field({ code: 'town', component: 'TextInput' }),
  ],
})
```

**Key Points:**
- `when` is **required** - actions always need a trigger condition
- Only the **first matching** `onAction` executes (first-match semantics)
- Effects are **immediately committed** before blocks evaluate
- No navigation - `onAction` always stays on the same page
- Use `onSubmission` with `when` clauses to prevent both firing on the same POST

**Execution Order on POST:**
```
1. onLoad effects run
2. onAccess guards checked
3. onAction transitions evaluated (first match executes)
4. Answers snapshot captured (AFTER action effects)
5. Blocks evaluate (sees action-set values)
6. onSubmission transitions run
```

### 4. onSubmission - Form Submissions

**Purpose**: Handle form submissions, validation, and navigation
**When it runs**: When user submits the form
**Can include**: Validation, effects, conditional navigation

```typescript
interface SubmitTransition {
  when?: PredicateExpr            // Which action triggered (e.g., button click)
  guards?: PredicateExpr          // Additional permission checks
  validate: boolean               // Should validate form fields
  onAlways?: {                    // Runs regardless of validation
    effects?: EffectFunctionExpr[]
    next?: NextExpr[]
  }
  onValid?: {                     // Runs if validation passes
    effects?: EffectFunctionExpr[]
    next: NextExpr[]
  }
  onInvalid?: {                   // Runs if validation fails
    effects?: EffectFunctionExpr[]
    next: NextExpr[]
  }
}
```

**Usage Examples:**

#### Standard Form Progression
```typescript
step({
  onSubmission: [
    submitTransition({
      when: Post('action').match(Condition.Equals('continue')),
      validate: true,
      onValid: {
        effects: [Effect.Save()],
        next: [{ goto: '/next-step' }]
      },
      onInvalid: {
        effects: [Effect.SaveDraft()],
        next: [{ goto: '@self' }]  // Stay on current step
      }
    })
  ]
})
```

#### Multiple Actions
```typescript
step({
  onSubmission: [
    // Save draft without validation
    submitTransition({
      when: Post('action').match(Condition.Equals('save-draft')),
      validate: false,
      onAlways: {
        effects: [Effect.SaveDraft()],
        next: [{ goto: '/dashboard' }]
      }
    }),

    // Delete with guards
    submitTransition({
      when: Post('action').match(Condition.Equals('delete')),
      guards: Data('user.canDelete').match(Condition.Equals(true)),
      validate: false,
      onAlways: {
        effects: [Effect.Delete()],
        next: [{ goto: '/list' }]
      }
    }),

    // Continue with validation
    submitTransition({
      when: Post('action').match(Condition.Equals('continue')),
      validate: true,
      onValid: {
        effects: [Effect.Save()],
        next: [{ goto: '/next-step' }]
      },
      onInvalid: {
        next: [{ goto: '@self' }]
      }
    })
  ]
})
```

#### Branching Navigation
```typescript
submitTransition({
  when: Post('action').match(Condition.Equals('continue')),
  validate: true,
  onValid: {
    effects: [Effect.Save()],
    next: [
      {
        when: Answer('user_type').match(Condition.Equals('individual')),
        goto: '/individual-flow'
      },
      {
        when: Answer('user_type').match(Condition.Equals('business')),
        goto: '/business-flow'
      },
      {
        goto: '/default-flow'  // Fallback
      }
    ]
  }
})
```

**Execution Order for Submissions:**
1. **Trigger Evaluation** - Check if `when` condition matches
2. **Guard Checking** - Evaluate `guards` if present
3. **Always Effects** - Execute `onAlways.effects` if defined
4. **Validation** - If `validate: true`, validate all step fields
5. **Outcome Effects** - Execute `onValid.effects` or `onInvalid.effects`
6. **Navigation** - Process appropriate `next` array

**Key Points:**
- Transitions are evaluated in array order (first match wins)
- Place more specific conditions before general ones
- `validate: false` skips validation entirely
- `onAlways` runs before validation (useful for collection updates)
- Guards should not reference `Post()` data when used for journey traversal

## Navigation System

The `next` / `redirect` property defines where users go after transitions:

### Simple Navigation
```typescript
// When matching a onSubmit hook
next: [{ goto: '/next-step' }]

// When failing a onAccess guard
redirect: [{ goto: '/the-serious-room' }]
```

### Conditional Navigation
```typescript
next: [
  {
    when: Answer('age').match(Condition.GreaterThan(65)),
    goto: '/senior-options'
  },
  {
    when: Answer('age').match(Condition.LessThan(18)),
    goto: '/youth-options'
  },
  {
    goto: '/standard-options'  // Default fallback
  }
]
```

### Dynamic Paths
```typescript
next: [
  {
    goto: Format('/users/%1/profile', Answer('user_id'))
  }
]
```

### Special Navigation Values
- `@self` - Stay on current step
- `/path` - Navigate to specific step
- `Format(...)` - Dynamic path construction

## Common Patterns

### 1. Authentication Flow
Note - You probably still want to use classic middleware for this, I just couldn't think of a better example!

```typescript
journey({
  onLoad: loadTransition({
    effects: [Effect.LoadCurrentUser()]
  }),

  onAccess: accessTransition({
    guards: Data('user.hasRole').match(Condition.Equals('ADMIN')),
    effects: [Analytics.TrackSession()],
    next: [{ goto: '/login' }]
  })
})
```

### 2. Multi-Step Form with Validation
```typescript
step({
  path: '/personal-details',

  onLoad: loadTransition({
    effects: [Effect.LoadDraft('personal')]
  }),

  onSubmission: [
    submitTransition({
      when: Post('action').match(Condition.Equals('continue')),
      validate: true,
      onValid: {
        effects: [Effect.Save()],
        next: [{ goto: '/contact-details' }]
      },
      onInvalid: {
        next: [{ goto: '@self' }]
      }
    })
  ]
})
```

### 3. Collection Management
```typescript
step({
  onSubmission: [
    // Add item
    submitTransition({
      when: Post('action').match(Condition.Equals('add-item')),
      validate: false,
      onAlways: {
        effects: [
          Effect.AddToCollection({
            collection: Answer('items'),
            item: { /* new item */ }
          })
        ],
        next: [{ goto: '@self' }]
      }
    }),

    // Remove item
    submitTransition({
      when: Post('action').match(Condition.MatchesRegex('^remove-(.+)$')),
      validate: false,
      onAlways: {
        effects: [
          Effect.RemoveFromCollection({
            collection: Answer('items'),
            index: /* extract from regex */
          })
        ],
        next: [{ goto: '@self' }]
      }
    })
  ]
})
```

### 4. Save States and Auto-Save
```typescript
onSubmission: [
  // Auto-save on any action
  submitTransition({
    when: Post('action').match(Condition.Any()),
    validate: false,
    onAlways: {
      effects: [Effect.AutoSave()]
    }
  }),

  // Explicit save
  submitTransition({
    when: Post('action').match(Condition.Equals('save')),
    validate: true,
    onValid: {
      effects: [Effect.Save()],
      next: [{ goto: '/dashboard' }]
    }
  })
]
```

### 5. Conditional Data Loading
```typescript
step({
  onLoad: loadTransition({
    effects: [
      Effect.LoadSection('basic'),
      // Effect determines internally what to load based on mode
      Effect.LoadConditionalData(Query('mode'))
    ]
  })
})
```

### 6. Address Lookup with onAction
```typescript
step({
  path: '/address',

  // Handle the lookup button - runs BEFORE blocks render
  onAction: [
    actionTransition({
      when: Post('findAddress').match(Condition.Equals('lookup')),
      effects: [Effect.LookupPostcode(Answer('postcode'))],
    }),
  ],

  // Handle form submission - runs AFTER blocks render
  onSubmission: [
    submitTransition({
      when: Post('action').match(Condition.Equals('continue')),
      validate: true,
      onValid: {
        effects: [Effect.SaveAddress()],
        next: [{ goto: '/contact-details' }],
      },
    }),
  ],

  blocks: [
    field({ code: 'postcode', component: 'TextInput', label: 'Postcode' }),
    // Button that triggers the onAction lookup
    block({ component: 'Button', name: 'findAddress', value: 'lookup', label: 'Find Address' }),
    // These fields are populated by the lookup effect
    field({ code: 'addressLine1', component: 'TextInput', label: 'Address Line 1' }),
    field({ code: 'addressLine2', component: 'TextInput', label: 'Address Line 2' }),
    field({ code: 'town', component: 'TextInput', label: 'Town' }),
    field({ code: 'county', component: 'TextInput', label: 'County' }),
  ],
})
```

**Why this works:**
1. User enters postcode and clicks "Find Address"
2. `onAction` fires because `Post('findAddress')` equals `'lookup'`
3. `LookupPostcode` effect runs and sets `addressLine1`, `town`, etc.
4. Blocks render with the populated address fields
5. `onSubmission` does NOT fire (different `when` condition)
6. User can edit the address and click "Continue" to proceed

## Best Practices

### 1. Load Data at the Right Level
- **Journey-level**: User data, permissions, global settings, section-specific data
- **Step-level**: Step-specific data, calculated values

### 2. Order Matters
- In `onSubmission` arrays, place specific triggers before general ones
- The first matching transition wins

### 3. Guards vs Validation
- **Guards** (`onAccess`, `onSubmission.guards`): Permission and access control
- **Validation** (`onSubmission.validate`): Field value validation
- Don't use `Post()` values in guards that affect journey traversal

### 4. Always Provide Fallbacks
```typescript
next: [
  { when: condition1, goto: '/path1' },
  { when: condition2, goto: '/path2' },
  { goto: '/default' }  // Always include a default
]
```

### 5. Effect Guidelines
- One effect = one responsibility
- Effects in `onLoad` should populate the Data/Answer context
- Effects in `onAccess` should be for analytics/logging
- Effects in `onSubmission` should handle saves and state changes

### 6. Validation Strategy
- Use `validate: true` for primary continue actions
- Use `validate: false` for drafts, deletes, and navigation
- Consider `submissionOnly` validation for expensive checks

## Execution Flow Diagram

```
User Accesses Journey (GET)
    ↓
Journey.onLoad (effects)
    ↓
Journey.onAccess (guards → effects → redirect?)
    ↓
User Accesses Step (GET)
    ↓
Step.onLoad (effects)
    ↓
Step.onAccess (guards → effects → redirect?)
    ↓
Blocks Render
    ↓
User Submits Form (POST)
    ↓
Step.onLoad (effects)
    ↓
Step.onAccess (guards → effects → redirect?)
    ↓
Step.onAction (when → effects) ← NEW: runs before blocks
    ↓
Blocks Render (with action-set values)
    ↓
Step.onSubmission (when → guards → validate → effects → next)
```
