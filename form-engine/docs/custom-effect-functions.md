# Creating Custom Effect Functions

## Overview
The form system allows you to create custom effect functions that perform side effects during
form transitions. Custom effects integrate seamlessly with the transition system and can be
used to load data, save state, call APIs, or perform any other side effects needed during
the form lifecycle.

## Creating Custom Effects

### Basic Structure
Custom effects are created using the `defineEffects` helper, which ensures proper typing
and integration with the form engine:

```typescript
import { defineEffects } from '@form-engine/registry/utils/createRegisterableFunction'

const { effects: MyCustomEffects, registry: MyCustomEffectsRegistry } = defineEffects({
  SaveProgress: async (context) => {
    const data = context.getAnswers()
    await api.saveProgress(data)
  },
  LogAction: (context, action: string) => {
    console.log(`Action: ${action}`, context.getAnswers())
  }
})

// Usage in transitions
effects: [MyCustomEffects.SaveProgress()]
```

### Function Signature
The `defineEffects` helper takes an object where:

- **Keys** are the effect names (use PascalCase for consistency)
- **Values** are evaluator functions `(context, ...args) => void | Promise<void>`

It returns an object with:
- **effects**: Builder functions for creating effect expressions
- **registry**: Registry object for registration with FormEngine

### The Context Object
The first parameter of every effect function is the form context, which provides access to:

> [!WARNING]
> **TODO**: This likely isn't final, we'll see how this plays out.

- `context.getAnswers()` - Get current form answers
- `context.setAnswers(answersObject)` - Set current form answers
- `context.getAnswer()` - Get form answer
- `context.setAnswer(key, value)` - Get form answer
- `context.getData(key)` - Retrieve stored data
- `context.setData(key, value)` - Store data in the form context
- `context.getCurrentStep()` - Get current step information
- `context.getJourney()` - Get journey configuration

### Parameters and Type Safety
Custom effects can accept additional parameters with full TypeScript support:

```typescript
const { effects, registry } = defineEffects({
  // Single parameter effect
  LoadSection: async (context, sectionName: string) => {
    const data = await api.loadSection(sectionName)
    context.setData(sectionName, data)
  },

  // Multiple parameters
  SaveWithOptions: async (context, endpoint: string, options?: SaveOptions) => {
    const answers = context.getAnswers()
    await api.save(endpoint, answers, options)
  },

  // Complex parameter types
  TrackAnalytics: (context, event: string, properties?: Record<string, any>) => {
    analytics.track({
      event,
      userId: context.getData('userId'),
      properties: {
        step: context.getCurrentStep().path,
        ...properties
      }
    })
  }
})
```

TypeScript will enforce these types when the effect is used:

```typescript
// TypeScript will enforce correct types
effects: [
  effects.LoadSection('accommodation'),              // ✓ Correct
  effects.LoadSection(),                             // ✗ Type error - missing parameter
  effects.SaveWithOptions('/api/save', { draft: true }) // ✓ Correct with options
]
```

## Dependency Injection
For effects that require external services or dependencies, use `defineEffectsWithDeps`:

```typescript
import { defineEffectsWithDeps } from '@form-engine/registry/utils/createRegisterableFunction'

const deps = {
  assessmentService: new AssessmentService(db),
  analytics: new AnalyticsService(),
  logger: new Logger()
}

const { effects: AssessmentEffects, registry: AssessmentEffectsRegistry } = defineEffectsWithDeps(deps, {
  LoadAssessment: (deps) => async (context, assessmentId: string) => {
    const data = await deps.assessmentService.loadAssessment(assessmentId)
    context.setData('assessment', data)
  },

  SaveAssessment: (deps) => async (context, options?: { draft?: boolean }) => {
    await deps.assessmentService.save(context.getAnswers(), options)
    deps.logger.info('Assessment saved', { draft: options?.draft })
  },

  CompleteSection: (deps) => async (context, section: string) => {
    await deps.assessmentService.completeSection(section)
    context.setData(`${section}.completed`, true)
    deps.analytics.track('section_completed', { section })
  }
})

// Usage in form configuration - clean and dependency-free
onLoad: loadTransition({
  effects: [
    AssessmentEffects.LoadAssessment(Data('assessmentId'))
  ]
})

onSubmission: submitTransition({
  onValid: {
    effects: [
      AssessmentEffects.SaveAssessment({ draft: false }),
      AssessmentEffects.CompleteSection('accommodation')
    ]
  },
  onInvalid: {
    effects: [AssessmentEffects.SaveAssessment({ draft: true })]
  }
})

// At application startup
formEngine.registerFunctions(AssessmentEffectsRegistry)
```

## Examples
Here are various examples to inspire you to build your own effects.

```typescript
const { effects, registry } = defineEffects({
  LogFormStart: (context) => {
    logger.log('Form started:', {
      journey: context.getJourney().code,
      timestamp: new Date().toISOString()
    })
  },

  PrefillFromDatabase: async (context, userId: string) => {
    const userData = await database.getUser(userId)

    // Prefill form with existing data
    Object.entries(userData).forEach(([key, value]) => {
      context.setData(`prefilled.${key}`, value)
    })
  },

  SendNotification: async (context, type: 'email' | 'sms', template: string) => {
    const user = context.getData('user')
    const answers = context.getAnswers()

    await notifyService.send({
      type,
      template,
      recipient: user,
      data: answers
    })
  },

  IncrementProgress: (context, stepName: string) => {
    const progress = context.getData('progress') || {}
    progress[stepName] = {
      completed: true,
      timestamp: Date.now()
    }

    const totalSteps = context.getJourney().steps.length
    const completedSteps = Object.keys(progress).length
    const percentage = Math.round((completedSteps / totalSteps) * 100)

    context.setData('progress', progress)
    context.setData('progressPercentage', percentage)
  }
})
```

### Async Effects
Effects commonly perform asynchronous operations like API calls:

> [!IMPORTANT]
> Always handle errors appropriately in async effects to prevent form submission failures.
> Consider using try-catch blocks and providing fallback behavior.

```typescript
const { effects, registry } = defineEffects({
  SyncWithBackend: async (context, retries: number = 3) => {
    let lastError: Error | null = null

    for (let i = 0; i < retries; i++) {
      try {
        await api.sync(context.getAnswers())
        return
      } catch (error) {
        lastError = error as Error
        // Exponential backoff implementation
      }
    }

    // Store error for later handling
    context.setData('syncError', lastError?.message)
    throw lastError
  }
})
```

## Using Effects in Transitions
Effects are used within transition definitions to perform actions at specific points:

```typescript
// On form load
onLoad: loadTransition({
  effects: [
    AssessmentEffects.LoadAssessment(Data('assessmentId')),
    effects.PrefillFromDatabase(Data('userId'))
  ]
})

// On submission
onSubmission: [
  submitTransition({
    when: Post('action').match(Equals('continue')),
    validate: true,
    onValid: {
      effects: [
        AssessmentEffects.SaveAssessment(),
        effects.TrackAnalytics('step_completed', { step: 'accommodation' })
      ],
      next: [{ goto: 'next-step' }]
    },
    onInvalid: {
      effects: [AssessmentEffects.SaveAssessment({ draft: true })],
      next: [{ goto: '@self' }]
    }
  })
]

// On always (regardless of validation)
onAlways: {
  effects: [
    effects.IncrementProgress('current-step'),
    effects.CacheResponses('form-cache', 7200)
  ]
}
```

## Registration
Effects must be registered with the FormEngine to be available for use in forms.

```typescript
import FormEngine from '@form-engine/core/FormEngine'
import { defineEffects, defineEffectsWithDeps } from '@form-engine/registry/utils/createRegisterableFunction'

// Define simple effects without dependencies
const { effects: SimpleEffects, registry: SimpleEffectsRegistry } = defineEffects({
  LogAction: (context, action: string) => {
    console.log(`Action: ${action}`, context.getAnswers())
  },
  ClearCache: (context) => {
    context.setData('cache', null)
  }
})

// Define effects with dependencies
const deps = {
  myService: new MyService(config),
  logger: new Logger()
}

const { effects: ServiceEffects, registry: ServiceEffectsRegistry } = defineEffectsWithDeps(deps, {
  Save: (deps) => async (context) => {
    await deps.myService.save(context.getAnswers())
    deps.logger.info('Data saved')
  },
  Load: (deps) => async (context, id: string) => {
    const data = await deps.myService.load(id)
    context.setAnswers(data)
  }
})

// Create the form engine instance
const formEngine = new FormEngine()

// Register the effects using their registries
formEngine.registerFunctions(SimpleEffectsRegistry)
formEngine.registerFunctions(ServiceEffectsRegistry)

// Export effects for use in form definitions
export { SimpleEffects, ServiceEffects }
```

### Registration Notes
- Effects are registered using the same `registerFunction`/`registerFunctions` methods as conditions and transformers
- Functions are stored by their `name` property in the FunctionRegistry
- Attempting to register a duplicate name will throw a `RegistryDuplicateError`
- Invalid function specs will throw a `RegistryValidationError`
- Multiple errors are collected and thrown as an `AggregateError`

## Error Handling
Effects should handle errors appropriately and provide meaningful error messages:

```typescript
const { effects, registry } = defineEffects({
  RobustApiCall: async (context, endpoint: string) => {
    try {
      const response = await fetch(endpoint)

      if (!response.ok) {
        // Handle HTTP errors
        if (response.status === 404) {
          context.setData('error', 'Resource not found')
          return
        }

        throw new Error(`API call failed: ${response.statusText}`)
      }

      context.setData('someApiCall', await response.json())
    } catch (error) {
      // Log error for debugging
      console.error('API call failed:', error)

      // Store error in context for UI display
      context.setData('lastError', {
        message: error.message,
        timestamp: Date.now()
      })

      // Re-throw to prevent form progression
      throw error
    }
  }
})
```

## Best Practices

### 1. Naming Conventions
Use descriptive PascalCase names that clearly indicate the effect's purpose:

```typescript
// Good
SaveAssessment
LoadUserData
SendConfirmationEmail
TrackFormProgress

// Avoid
doStuff
effect1
handleData
```

### 2. Idempotency
Design effects to be idempotent where possible - running them multiple times should have the same result:

```typescript
const { effects, registry } = defineEffects({
  // Good - idempotent
  MarkSectionComplete: async (context, section: string) => {
    // Check if already complete
    if (context.getData(`${section}.completed`)) {
      return
    }

    const result = await api.completeSection(section)
    context.setData(`${section}.completed`, true)
  },

  // Avoid - not idempotent
  IncrementCounter: (context) => {
    const count = context.getData('count') || 0
    context.setData('count', count + 1) // Will increment each time
  }
})
```

### 3. Error Recovery
Provide graceful error handling and recovery mechanisms:

```typescript
const { effects, registry } = defineEffects({
  SaveWithFallback: async (context) => {
    try {
      // Try primary save
      await api.save(context.getAnswers())
    } catch (error) {
      // Fallback to local storage
      localStorage.setItem('backup', JSON.stringify({
        data: context.getAnswers(),
        error: error.message,
        timestamp: Date.now()
      }))

      // Don't block form progression
      context.setData('saveError', 'Saved locally, will sync later')
    }
  }
})
```

### 4. Performance Considerations
Be mindful of performance, especially for effects that run frequently:

### 5. Context Data Management
Use clear namespacing when storing data in context:

```typescript
const { effects, registry } = defineEffects({
  StoreData: (context, section: string, data: any) => {
    context.setData(`assessment.${section}.data`, data)
    context.setData(`assessment.${section}.lastUpdated`, Date.now())
  }
})
```

## JSON Output

When custom effects are used in form configuration, they compile to the standard function format:

```typescript
// Usage in configuration
effects: [
  AssessmentEffects.SaveAssessment({ draft: true }),
  effects.TrackAnalytics('save_draft', { step: 'accommodation' })
]

// Compiles to JSON
{
  effects: [
    {
      type: 'FunctionType.Effect',
      name: 'SaveAssessment',
      arguments: [{ draft: true }]
    },
    {
      type: 'FunctionType.Effect',
      name: 'TrackAnalytics',
      arguments: ['save_draft', { step: 'accommodation' }]
    }
  ]
}
```
