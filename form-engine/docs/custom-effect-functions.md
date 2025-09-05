# Creating Custom Effect Functions

## Overview
The form system allows you to create custom effect functions that perform side effects during
form transitions. Custom effects integrate seamlessly with the transition system and can be
used to load data, save state, call APIs, or perform any other side effects needed during
the form lifecycle.

## Creating Custom Effects

### Basic Structure
Custom effects are created using the `buildEffectFunction` helper, which ensures proper typing
and integration with the form engine:

```typescript
import { buildEffectFunction } from '@form-system/helpers'

const MyCustomEffects = {
  saveProgress: buildEffectFunction(
    'saveProgress',
    async (context) => {
      const data = context.getAnswers()
      await api.saveProgress(data)
    }
  )
}

// Usage in transitions
effects: [MyCustomEffects.saveProgress()]
```

### Function Signature
The `buildEffectFunction` helper takes two parameters:

1. **name** (`string`): The unique identifier for your effect. Use camelCase for consistency.
2. **evaluator** (`(context, ...args) => any | Promise<any>`): The function that performs the side effect

```typescript
buildEffectFunction<A extends readonly ValueExpr[]>(
  name: string,
  evaluator: (context: FormContext, ...args: A) => any | Promise<any>
)
```

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
// Single parameter effect
const loadSection = buildEffectFunction(
  'loadSection',
  async (context, sectionName: string) => {
    const data = await api.loadSection(sectionName)
    context.setData(sectionName, data)
  }
)

// Multiple parameters
const saveWithOptions = buildEffectFunction(
  'saveWithOptions',
  async (context, endpoint: string, options?: SaveOptions) => {
    const answers = context.getAnswers()
    await api.save(endpoint, answers, options)
  }
)

// Complex parameter types
const trackAnalytics = buildEffectFunction(
  'trackAnalytics',
  (context, event: string, properties?: Record<string, any>) => {
    analytics.track({
      event,
      userId: context.getData('userId'),
      properties: {
        step: context.getCurrentStep().path,
        ...properties
      }
    })
  }
)
```

TypeScript will enforce these types when the effect is used:

```typescript
// TypeScript will enforce correct types
effects: [
  loadSection('accommodation'),              // ✓ Correct
  loadSection(),                             // ✗ Type error - missing parameter
  saveWithOptions('/api/save', { draft: true }) // ✓ Correct with options
]
```

## Dependency Injection
For effects that require external services or dependencies, use the dependency injection pattern.
This pattern allows you to keep your form configurations clean and free from implementation details:

```typescript
// Create injectable effect factories
const assessmentEffectFactories = {
  // Each factory is a function that takes the service and returns a RegistryFunction
  Load: (service: AssessmentService) =>
    buildEffectFunction(
      'loadAssessment',
      async (context, assessmentId: string) => {
        const data = await service.loadAssessment(assessmentId)
        context.setData('assessment', data)
      }
    ),

  Save: (service: AssessmentService) =>
    buildEffectFunction(
      'saveAssessment',
      async (context, options?: { draft?: boolean }) => {
        await service.save(context.getAnswers(), options)
      }
    ),

  CompleteSection: (service: AssessmentService) =>
    buildEffectFunction(
      'completeSection',
      async (context, section: string) => {
        await service.completeSection(section)
        context.setData(`${section}.completed`, true)
      }
    )
}

// Create proxy for use in form configuration (no dependencies needed here)
export const AssessmentEffects = createInjectableFunctions(assessmentEffectFactories, FunctionType.EFFECT)

// Usage in form configuration - clean and dependency-free
import { AssessmentEffects } from './effects'

onLoad: loadTransition({
  effects: [
    AssessmentEffects.Load(Data('assessmentId'))
  ]
})

onSubmission: submitTransition({
  onValid: {
    effects: [
      AssessmentEffects.Save({ draft: false }),
      AssessmentEffects.CompleteSection('accommodation')
    ]
  },
  onInvalid: {
    effects: [AssessmentEffects.SaveDraft()]
  }
})

// At application startup
const assessmentService = new AssessmentServiceImpl(db, logger)
formEngine.registerEffects(resolveInjectableFunctions(assessmentEffectFactories, assessmentService))
```

## Examples
Here are various examples to inspire you to build your own effects.

```typescript
const logFormStart = buildEffectFunction(
  'logFormStart',
  (context) => {
    logger.log('Form started:', {
      journey: context.getJourney().code,
      timestamp: new Date().toISOString()
    })
  }
)

const prefillFromDatabase = buildEffectFunction(
  'prefillFromDatabase',
  async (context, userId: string) => {
    const userData = await database.getUser(userId)

    // Prefill form with existing data
    Object.entries(userData).forEach(([key, value]) => {
      context.setData(`prefilled.${key}`, value)
    })
  }
)

const sendNotification = buildEffectFunction(
  'sendNotifyEmail',
  async (context, type: 'email' | 'sms', template: string) => {
    const user = context.getData('user')
    const answers = context.getAnswers()

    await notifyService.send({
      type,
      template,
      recipient: user,
      data: answers
    })
  }
)

const incrementProgress = buildEffectFunction(
  'incrementProgress',
  (context, stepName: string) => {
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
)
```

### Async Effects
Effects commonly perform asynchronous operations like API calls:

> [!IMPORTANT]
> Always handle errors appropriately in async effects to prevent form submission failures.
> Consider using try-catch blocks and providing fallback behavior.

```typescript
const syncWithBackend = buildEffectFunction(
  'syncWithBackend',
  async (context, retries: number = 3) => {
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
)
```

## Using Effects in Transitions
Effects are used within transition definitions to perform actions at specific points:

```typescript
// On form load
onLoad: loadTransition({
  effects: [
    AssessmentEffects.Load(Data('assessmentId')),
    prefillFromDatabase(Data('userId'))
  ]
})

// On submission
onSubmission: [
  submitTransition({
    when: Post('action').match(Equals('continue')),
    validate: true,
    onValid: {
      effects: [
        AssessmentEffects.Save(),
        trackAnalytics('step_completed', { step: 'accommodation' })
      ],
      next: [{ goto: 'next-step' }]
    },
    onInvalid: {
      effects: [AssessmentEffects.SaveDraft()],
      next: [{ goto: '@self' }]
    }
  })
]

// On always (regardless of validation)
onAlways: {
  effects: [
    incrementProgress('current-step'),
    cacheResponses('form-cache', 7200)
  ]
}
```

## Registration
> [!WARNING]
> **TODO**: The registration process will be implemented when configuring the form library.
> Users will provide an array of custom functions during initialization.


### Direct Registration (Without Dependency Injection)
For simple effects without external dependencies:

```typescript
const simpleEffects = {
  logAction: buildEffectFunction(
    'logAction',
    (context, action: string) => {
      console.log(`Action: ${action}`, context.getAnswers())
    }
  ),
  clearCache: buildEffectFunction(
    'clearCache',
    (context) => {
      context.setData('cache', null)
    }
  )
}

// Register directly with the form engine
formEngine.registerEffects(Object.values(simpleEffects))
```

### Registration with Dependency Injection
For effects that require services or dependencies:

```typescript
// 1. Define your injectable factories
const effectFactories = {
  Save: (service: MyService) =>
    buildEffectFunction('save', async (context) => {
      await service.save(context.getAnswers())
    }),
  Load: (service: MyService) =>
    buildEffectFunction('load', async (context, id: string) => {
      const data = await service.load(id)
      context.setAnswers(data)
    })
}

// 2. Create proxy for form configuration
export const MyEffects = createInjectableFunctions(effectFactories, FunctionType.EFFECT)

// 3. At application initialization, resolve and register
const myService = new MyService(config)
const resolvedEffects = resolveInjectableFunctions(effectFactories, myService)
formEngine.registerEffects(Object.keys(resolvedEffects))
```

## Error Handling
Effects should handle errors appropriately and provide meaningful error messages:

```typescript
const robustApiCall = buildEffectFunction(
  'robustApiCall',
  async (context, endpoint: string) => {
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

      context.setData('someApiCall', response.json())
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
)
```

## Best Practices

### 1. Naming Conventions
Use descriptive camelCase names that clearly indicate the effect's purpose:

```typescript
// Good
saveAssessment
loadUserData
sendConfirmationEmail
trackFormProgress

// Avoid
doStuff
effect1
handleData
```

### 2. Idempotency
Design effects to be idempotent where possible - running them multiple times should have the same result:

```typescript
// Good - idempotent
const markSectionComplete = buildEffectFunction(
  'markSectionComplete',
  async (context, section: string) => {
    // Check if already complete
    if (context.getData(`${section}.completed`)) {
      return { already_complete: true }
    }

    const result = await api.completeSection(section)
    context.setData(`${section}.completed`, true)
  }
)

// Avoid - not idempotent
const incrementCounter = buildEffectFunction(
  'incrementCounter',
  (context) => {
    const count = context.getData('count') || 0
    context.setData('count', count + 1) // Will increment each time
  }
)
```

### 3. Error Recovery
Provide graceful error handling and recovery mechanisms:

```typescript
const saveWithFallback = buildEffectFunction(
  'saveWithFallback',
  async (context) => {
    try {
      // Try primary save
      return await api.save(context.getAnswers())
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
)
```

### 4. Performance Considerations
Be mindful of performance, especially for effects that run frequently:

### 5. Context Data Management
Use clear namespacing when storing data in context:

```typescript
const dataStorage = buildEffectFunction(
  'dataStorage',
  (context, section: string, data: any) => {
    context.setData(`assessment.${section}.data`, data)
    context.setData(`assessment.${section}.lastUpdated`, Date.now())
  }
)
```

## JSON Output

When custom effects are used in form configuration, they compile to the standard function format:

```typescript
// Usage in configuration
effects: [
  AssessmentEffects.Save({ draft: true }),
  trackAnalytics('save_draft', { step: 'accommodation' })
]

// Compiles to JSON
{
  effects: [
    {
      type: 'FunctionType.Effect',
      name: 'saveAssessment',
      arguments: [{ draft: true }]
    },
    {
      type: 'FunctionType.Effect',
      name: 'trackAnalytics',
      arguments: ['save_draft', { step: 'accommodation' }]
    }
  ]
}
```
