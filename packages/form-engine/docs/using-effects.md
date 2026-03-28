# Effects

Effects perform side effects during form processing - loading data from APIs, saving answers, looking up addresses, sending notifications. They run at specific points in the form lifecycle.

## What is an Effect?

An effect is a function that performs side effects during form processing. Unlike generators (which generate
values), conditions (which test values) or transformers (which modify values), effects interact with external
systems - APIs, databases, sessions, and services.

This enables:
- Loading data from APIs to populate forms
- Saving answers to databases or external services
- Pre-populating fields from loaded data
- In-page actions like postcode lookups
- Session management and progress tracking
- Analytics, notifications, and logging

### Import

```typescript
import { defineEffects, defineEffectsWithDeps } from '@form-engine/registry/utils/createRegisterableFunction'
import EffectFunctionContext from '@form-engine/core/ast/thunks/EffectFunctionContext'
```

---

## Basic Usage

### Effects in Transitions

Effects are used inside transitions. They run at specific lifecycle points:

```typescript
import { accessTransition, submitTransition, next } from '@form-engine/form/builders'
import { MyEffects } from './effects'

step({
  path: '/my-step',
  title: 'My Step',

  // Access effects run when the step is accessed
  onAccess: [
    accessTransition({
      effects: [
        MyEffects.loadUserProfile(),
        MyEffects.loadReferenceData(),
      ],
    }),
  ],

  // Submit effects run when the form is submitted
  onSubmission: [
    submitTransition({
      validate: true,
      onValid: {
        effects: [MyEffects.saveAnswers()],
        next: [redirect({ goto: 'next-step' })],
      },
    }),
  ],

  blocks: [/* ... */],
})
```

### Effect Parameters

Effects can accept parameters - both static values and dynamic expressions:

```typescript
// Static parameter
MyEffects.loadAssessment('assessment-123')

// Dynamic: from URL route parameter
MyEffects.loadAssessment(Params('id'))

// Dynamic: from POST body
MyEffects.lookupPostcode(Post('postcode'))

// Multiple parameters
MyEffects.saveWithOptions('accommodation', { draft: true })
```

---

## The Context Object

Every effect receives an `EffectFunctionContext` as its first parameter. This provides methods to read and write form state:

### Reading Data

```typescript
// Answers (form field values)
context.getAnswer('fieldCode')     // Get single answer
context.getAllAnswers()               // Get all answers
context.hasAnswer('fieldCode')     // Check if answer exists

// Supplementary data
context.getData('key')             // Get specific data
context.getData()                  // Get all data

// Request information
context.getRequestParam('id')      // URL route parameter
context.getQueryParam('page')      // Query string parameter
context.getPostData('action')      // POST body value

// Session and state
context.getSession()               // Session object (mutable)
context.getState('user')           // Request-level state (e.g., user, csrfToken)
```

### Writing Data

```typescript
// Set form answers (pre-populate fields)
context.setAnswer('firstName', 'John')
context.setAnswer('email', user.email)

// Note: setAnswer() records a mutation in the answer history, tagged with the
// current lifecycle phase (e.g., 'access', 'action'). This enables tracking
// which phase set each value - useful for delta calculations and debugging.

// Set supplementary data (for use via Data())
context.setData('assessment', assessment)
context.setData('countries', countryList)

// Clear an answer
context.clearAnswer('temporaryField')

// Session is mutable - changes persist automatically
const session = context.getSession()
session.lastVisited = new Date().toISOString()
session.stepsCompleted.push('personal-details')
```

### `setAnswer()` vs `setData()`

| Method | Use For | Access In Forms Via |
|--------|---------|---------------------|
| `setAnswer()` | Pre-populating form fields, loading saved drafts | `Answer('code')` |
| `setData()` | API responses, reference data, dropdown options | `Data('key')` |

```typescript
// Loading saved answers into form fields
const draft = await api.loadDraft(draftId)
context.setAnswer('firstName', draft.firstName)
context.setAnswer('email', draft.email)

// Loading reference data for dropdowns
const countries = await api.getCountries()
context.setData('countries', countries)

// In the form, use Data() to access reference data
field<GovUKRadioInput>({
  code: 'country',
  items: Data('countries'),
})
```

---

## Where Effects Run

Effects are used in different transition types depending on when you need them to run:

| Transition | When Effects Run | Common Uses |
|------------|-----------------|-------------|
| `accessTransition` | Before evaluating conditions and redirects | Load data from APIs, populate dropdowns |
| `actionTransition` | During POST, before render | Postcode lookup, address fetch |
| `submitTransition` | After validation (onValid/onInvalid/onAlways) | Save answers, send notifications |

---

## Common Patterns

### Load and Save Cycle

```typescript
step({
  path: '/personal-details',
  title: 'Personal Details',

  onAccess: [
    accessTransition({
      effects: [
        MyEffects.loadUserProfile(Params('userId')),
        MyEffects.loadTitleOptions(),
      ],
    }),
  ],

  onSubmission: [
    submitTransition({
      validate: true,
      onValid: {
        effects: [
          MyEffects.savePersonalDetails(),
          MyEffects.trackStepComplete('personal-details'),
        ],
        next: [redirect({ goto: 'contact-details' })],
      },
      onInvalid: {
        effects: [MyEffects.saveDraft()],
        // Stay on page (no next)
      },
    }),
  ],

  blocks: [/* ... */],
})
```

### Postcode Lookup (In-Page Action)

```typescript
step({
  blocks: [
    postcodeField,
    block<GovUKButton>({
      variant: 'govukButton',
      text: 'Find address',
      name: 'action',
      value: 'lookup',
      classes: 'govuk-button--secondary',
    }),
    addressFields,
    continueButton,
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
        effects: [MyEffects.saveAnswers()],
        next: [redirect({ goto: 'next-step' })],
      },
    }),
  ],
})
```

### Pre-populating from API Data

Use `onAccess` to load and pre-populate form fields before the step is rendered:

```typescript
// In your step definition
onAccess: [
  accessTransition({
    effects: [MyEffects.loadAssessment(Params('assessmentId'))],
  }),
],
```

```typescript
// The effect definition
LoadAssessment: deps => async (context, assessmentId: string) => {
  const assessment = await deps.api.getAssessment(assessmentId)

  // Store full assessment as data
  context.setData('assessment', assessment)

  // Pre-populate form fields with saved answers
  Object.entries(assessment.answers || {}).forEach(([code, value]) => {
    context.setAnswer(code, value)
  })
}
```

---

## Custom Effects

### `defineEffects()` - Without Dependencies

Create effects that don't need external services:

```typescript
import { defineEffects } from '@form-engine/registry/utils/createRegisterableFunction'
import EffectFunctionContext from '@form-engine/core/ast/thunks/EffectFunctionContext'

export const { effects: MyEffects, registry: MyEffectsRegistry } = defineEffects({
  // Simple effect - no parameters
  InitializeSession: (context: EffectFunctionContext) => {
    const session = context.getSession()
    if (!session.startedAt) {
      session.startedAt = new Date().toISOString()
      session.stepsCompleted = []
    }
  },

  // Effect with parameters
  TrackStepComplete: (context: EffectFunctionContext, stepName: string) => {
    const session = context.getSession()
    if (!session.stepsCompleted.includes(stepName)) {
      session.stepsCompleted.push(stepName)
    }
  },

  // Async effect
  LoadData: async (context: EffectFunctionContext, endpoint: string) => {
    const response = await fetch(endpoint)
    const data = await response.json()
    context.setData('loadedData', data)
  },
})

// Registration
formEngine.registerFunctions(MyEffectsRegistry)
```

### `defineEffectsWithDeps()` - With Dependencies

Create effects that need access to external services:

```typescript
import { defineEffectsWithDeps } from '@form-engine/registry/utils/createRegisterableFunction'
import EffectFunctionContext from '@form-engine/core/ast/thunks/EffectFunctionContext'

interface MyEffectsDeps {
  api: AssessmentApiClient
  logger: Logger
}

export const { effects: MyEffects, createRegistry: createMyEffectsRegistry } =
  defineEffectsWithDeps<MyEffectsDeps>()({
    LoadAssessment: deps => async (context: EffectFunctionContext, assessmentId: string) => {
      deps.logger.info(`Loading assessment: ${assessmentId}`)
      const assessment = await deps.api.getAssessment(assessmentId)
      context.setData('assessment', assessment)

      Object.entries(assessment.answers || {}).forEach(([code, value]) => {
        context.setAnswer(code, value)
      })
    },

    SaveAnswers: deps => async (context: EffectFunctionContext) => {
      const assessmentId = context.getData('assessment').id
      const answers = context.getAllAnswers()

      await deps.api.saveAnswers(assessmentId, answers)
      deps.logger.info(`Answers saved for: ${assessmentId}`)
    },

    LookupPostcode: deps => async (context: EffectFunctionContext, postcode: string) => {
      if (!postcode?.trim()) return

      try {
        const address = await deps.api.lookupPostcode(postcode)
        if (address) {
          context.setAnswer('addressLine1', address.line1)
          context.setAnswer('town', address.town)
          context.setAnswer('county', address.county)
        } else {
          context.setData('postcodeError', 'Address not found')
        }
      } catch (error) {
        deps.logger.warn(`Postcode lookup failed: ${error.message}`)
        context.setData('postcodeError', 'Lookup service unavailable')
      }
    },
  })

// Registration - create registry with real deps at runtime
const registry = createMyEffectsRegistry({
  api: new AssessmentApiClient(),
  logger: logger,
})
formEngine.registerFunctions(registry)
```

### Combining Registries

```typescript
// Without dependencies
export const MyEffectsRegistry = {
  ...SessionEffectsRegistry,
  ...AnalyticsEffectsRegistry,
}

// Mixed (some with deps, some without)
export const createMyEffectsRegistry = (deps: ApiDeps) => ({
  ...SessionEffectsRegistry,           // No deps
  ...createApiEffectsRegistry(deps),   // Needs deps
})
```

---

## Error Handling

Effects should handle errors appropriately based on criticality:

```typescript
export const { effects, createRegistry } = defineEffectsWithDeps<MyDeps>()({
  // Critical: let errors propagate (stops form progression)
  SaveAnswers: deps => async (context) => {
    await deps.api.save(context.getAllAnswers())
  },

  // Non-critical: handle gracefully (don't block user)
  TrackAnalytics: deps => async (context, event: string) => {
    try {
      await deps.analytics.track(event, {
        sessionId: context.getSession().id,
      })
    } catch (error) {
      deps.logger.warn(`Analytics failed: ${error.message}`)
    }
  },

  // With retry logic
  SaveWithRetry: deps => async (context) => {
    const maxRetries = 3
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await deps.api.save(context.getAllAnswers())
        return
      } catch (error) {
        lastError = error as Error
        deps.logger.warn(`Save attempt ${attempt} failed`)
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
      }
    }

    throw lastError
  },
})
```

---

## Best Practices

### Use Dependency Injection

Prefer `defineEffectsWithDeps` for effects that need external services. This makes testing easier and keeps dependencies explicit:

```typescript
// DO: Inject dependencies
defineEffectsWithDeps<{ api: ApiClient }>()({
  LoadData: deps => async (context) => {
    const data = await deps.api.getData()
    context.setData('data', data)
  },
})

// DON'T: Import dependencies directly
defineEffects({
  LoadData: async (context) => {
    const data = await apiClient.getData()  // Hard to test
    context.setData('data', data)
  },
})
```

### Keep Effects Focused

Each effect should do one thing well. Split complex operations into multiple effects:

```typescript
// DO: Focused effects
MyEffects.loadAssessment(Params('id'))
MyEffects.loadReferenceData()
MyEffects.saveAnswers()
MyEffects.completeSection('personal')

// DON'T: Monolithic effects
MyEffects.loadEverythingAndSetupSession()
MyEffects.saveAndCompleteAndNotify()
```

### Name Descriptively

Use verb prefixes so purpose is clear:

```typescript
// Good names
LoadAssessment
SaveAnswers
LookupPostcode
SendNotification
TrackAnalytics
InitializeSession
CompleteSection

// Unclear names
HandleData
ProcessForm
DoStuff
```

### Design for Idempotency

Where possible, make effects safe to run multiple times:

```typescript
// DO: Check before modifying
InitializeSession: (context) => {
  const session = context.getSession()
  if (!session.initialized) {
    session.initialized = true
    session.startedAt = new Date().toISOString()
  }
}

// DON'T: Always modify
InitializeSession: (context) => {
  const session = context.getSession()
  session.startedAt = new Date().toISOString()  // Overwrites on every request
}
```

