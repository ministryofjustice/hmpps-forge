# Journeys and Steps Documentation

## Overview

The form system is built on a hierarchical structure where **Journeys** represent
complete multi-step form flows (like wizards), and **Steps** are the individual pages
within those journeys. This architecture enables complex, branching form flows with
conditional paths, data loading, and validation at each stage.

```
Journey (Complete flow)
├── Step 1 (Individual page)
├── Step 2 (Individual page)
├── Step 3 (Individual page)
└── Child Journey (Sub-flow)
    ├── Step A
    └── Step B
```

## Journeys

Journeys are the top-level containers that define an entire form flow from start to finish.
They orchestrate how users move through your forms, managing the overall structure and flow control.

### Structure

```typescript
interface JourneyDefinition {
  type: StructureType.JOURNEY     // Type identifier for JSON parsing
  code: string                    // Unique identifier for the journey
  title: string                   // Display title
  description?: string            // Optional description
  path?: string                   // Base URL path for the journey
  version?: string                // Version identifier for journey/form version
  controller?: string             // Custom Express controller (?)
  onLoad?: LoadTransition[]       // Load journey-specific data when accessed
  onAccess?: AccessTransition[]   // Check access and run analytics
  steps?: StepDefinition[]        // Steps/pages that make up the journey
  children?: JourneyDefinition[]  // Sub-journeys
}
```

### Basic Journey

```typescript
const registrationJourney = journey({
  code: 'user-registration',
  title: 'Create Your Account',
  description: 'Register for our service in just a few steps',
  version: '1.0',
  steps: [
    step({ path: '/personal-details', blocks: [...] }),
    step({ path: '/contact-info', blocks: [...] }),
    step({ path: '/preferences', blocks: [...] }),
    step({ path: '/review', blocks: [...] }),
    step({ path: '/confirmation', blocks: [...] }),
  ],
})
```

### Journey with Child Journeys

Child journeys allow you to compose complex flows from smaller, sub-journeys.
They can be conditionally included based on user data or choices using each sub-journey's guard.

> [!NOTE]
> Maybe there's some eventual use here for re-useable sub-journeys?

```typescript
const sanAssessmentJourney = journey({
  code: 'san-assessment',
  title: 'Strengths and Needs Assessment',
  version: '1.1',
  children: [
    accommodationJourney,
    healthAndWellbeingJourney,
    drugUseJourney
  ],
})
```

### Journey Properties

#### `code`
Unique identifier used for routing, data storage, and journey references.
Should be URL-safe and descriptive.

#### `title` and `description`
Human-readable text for UI display and documentation.
The title typically appears in progress indicators and navigation.

#### `path`
Optional base URL path that prefixes all step paths within the journey.
Useful for organizing related journeys under common routes.

```typescript
journey({
  code: 'example-journey',
  path: '/an-example-journey',  // Base path
  steps: [
    step({ path: '/step-1' }),    // Accessible at /an-example-journey/step-1
    step({ path: '/step-2' }),    // Accessible at /an-example-journey/step-2
    step({ path: '/step-3' }),    // Accessible at /an-example-journey/step-3
  ]
})
```

#### `version`
Tracks form version and enables migration strategies when form structures change over time.

> [!NOTE]
> For this, we'll need to build a system that takes transform functions tied to form version numbers
> i.e. 1.1 -> `Transform1.1()`, 1.2 -> `Transform1.2()` - and apply these in sequence over the existing submission data
> to migrate an existing submission to the latest version

#### `guard`
Conditional predicate that determines if the entire journey should be accessible.
Useful for feature flags or user-specific flows.

```typescript
journey({
  code: 'san-prison-journey',
  guard: and(
    Data('features.prisonEnabled').match(Condition.MatchesValue(true)),
    Data('user.location').match(Condition.MatchesValue('PRISON'))
  ),
  // ...
})
```

## Steps

Steps represent individual pages in your form journey. Each step contains blocks (UI components),
handles data loading, defines transitions to other steps, and manages validation.

### Structure
> [!NOTE]
> There's probably some important options I'm missing here in terms of `revalidate` etc as seen
> in HMPO Form Wizard, I've not spent long enough investigating that so would be good to get some opinions.

```typescript
interface StepDefinition {
  type: StructureType.STEP             // Type identifier for JSON parsing
  path: string                         // URL path for this step
  blocks: BlockDefinition[]            // UI components to render
  onLoad?: LoadTransition[]            // Load step-specific data when accessed
  onAccess?: AccessTransition[]        // Check access and run analytics
  onSubmission?: SubmitTransition[]    // Handle form submission transitions
  controller?: string                  // Custom Express controller (rare)
  template?: string                    // Custom Nunjucks template
  entry?: boolean                      // Mark as valid entry point
  checkJourneyTraversal?: boolean      // Verify user can reach this step
  backlink?: string                    // Override automatic back button
}
```

### Basic Step

```typescript
const personalDetailsStep = step({
  path: '/personal-details',
  blocks: [
    field({
      variant: 'text',
      code: 'first_name',
      label: 'First Name',
      validate: [ validation({
        when: Self().not.match(Condition.IsRequired()),
        message: 'First name is required'
      }) ],
    }),
    field({
      variant: 'text',
      code: 'last_name',
      label: 'Last Name',
      validate: [ validation({
        when: Self().not.match(Condition.IsRequired()),
        message: 'Last name is required'
      }) ],
    }),
    block({
      variant: 'button-group',
      blocks: [
        block({
          variant: 'button',
          buttonType: 'submit',
          name: 'action',
          value: 'continue'
        })
      ]
    })
  ],
  onSubmission: [
    submitTransition({
      when: Post('action').match(Condition.MatchesValue('continue')),
      validate: true,
      onValid: {
        effects: [Effect.save()],
        next: [{ goto: '/contact-info' }],
      },
      onInvalid: {
        next: [{ goto: '/personal-details' }],
      },
    }),
  ],
})
```

### Step with Data Loading
Steps can load external data using the `onLoad` hook, making it available to blocks and logic within the step.

```typescript
step({
  path: '/location-selection',

  // Load data using the onLoad hook
  onLoad: loadTransition({
    effects: [
      Effect.LoadCountries(),  // Loads data to Data('countries')
      Effect.LoadUserSavedLocations(),  // Loads data to Data('savedLocations')
    ]
  }),

  blocks: [
    field({
      variant: 'select',
      code: 'country',
      label: 'Select Country',
      items: Data('countries'), // Use loaded data
    }),
    field({
      variant: 'select',
      code: 'saved_location',
      label: 'Or choose a saved location',
      items: Data('savedLocations'),
      dependent: when(Data('savedLocations').match(Condition.LengthGreaterThan(0))),
    }),
    // ...
  ],
  // ...
})
```

### Step Properties

#### `path`
The URL path where this step is accessible. Can include parameters for dynamic routing.

> [!IMPORTANT]
> Any step that has a dynamic URL needs to have disabled `checkJourneyTraversal`.

```typescript
// Static path
step({ path: '/review' })

// Dynamic path with parameters
step({ path: '/items/:itemId/edit' })
```

These are then accessible using `Params('param-name')`

#### `blocks`
Array of UI components that make up the step's interface. These are rendered in order
and can include fields, blocks, and collection blocks.
See `block-type-documentation.md` for more details.

#### `onLoad`
Optional hook for loading step-specific data when the step is accessed. Uses effects to populate
the Data context, making it available for use in field configurations, validation, and conditional logic.
See `hooks-documentation.md` for more details.

#### `onAccess`
Optional hook for checking access permissions and running analytics when the step is accessed.
Can include guards, effects, and navigation logic. See `hooks-documentation.md` for more details.

#### `onSubmission`
Array of submission transition definitions that control how users move from this step to others
when the form is submitted. Transitions are evaluated in order, with the first matching transition being executed.
See `transition-documentation.md` for more details.

```typescript
onSubmission: [
  submitTransition({ when: Post('action').match(Condition.MatchesValue('save-draft')), validate: false, /* ... */ }),
  submitTransition({ when: Post('action').match(Condition.MatchesValue('continue')), validate: true, /* ... */ }),
]
```

#### `entry`
Marks a step as a valid entry point to the journey.
Users can navigate directly to entry steps without following the normal flow.

```typescript
step({
  path: '/summary',
  entry: true,  // Users can jump directly to summary
  // ...
})
```

#### `checkJourneyTraversal`
When `true`, validates that the user reached this step through valid navigation paths.
Prevents users from jumping to steps they shouldn't access yet.

```typescript
step({
  path: '/payment',
  checkJourneyTraversal: true,  // Must have completed previous steps
  // ...
})
```

#### `backlink`
Override the automatically calculated back button destination.
Useful for complex flows where the default back navigation isn't appropriate.

```typescript
step({
  path: '/error-recovery',
  backlink: '/dashboard',  // Always go back to dashboard
  // ...
})
```

#### `template`
Specify a custom Nunjucks template for rendering this step.
Useful when you need custom HTML structure beyond what the default template provides.

```typescript
step({
  path: '/custom-layout',
  template: 'templates/special-step.njk',
  // ...
})
```

## Common Patterns

### 1. Linear Flow
Simple progression through steps in order:

```typescript
journey({
  code: 'simple-survey',
  steps: [
    step({
      path: '/question-1',
      blocks: [ /*...*/ ],
      onSubmission: [
        submitTransition({
          validate: true,
          onValid: { next: [{ goto: '/question-2' }] },
          onInvalid: { next: [{ goto: '/question-1' }] },
        }),
      ],
    }),
    step({
      path: '/question-2',
      blocks: [ /*...*/ ],
      onSubmission: [
        submitTransition({
          validate: true,
          onValid: { next: [{ goto: '/question-3' }] },
          onInvalid: { next: [{ goto: '/question-2' }] },
        }),
      ],
    }),
    step({
      path: '/question-3',
      blocks: [ /*...*/ ],
      onSubmission: [
        submitTransition({
          validate: true,
          onValid: { next: [{ goto: '/complete' }] },
          onInvalid: { next: [{ goto: '/question-3' }] },
        }),
      ],
    }),
  ],
})
```

### 2. Branching Flow
Different paths based on user input:

```typescript
journey({
  code: 'application-flow',
  steps: [
    step({
      path: '/applicant-type',
      blocks: [
        field({
          variant: 'radio',
          code: 'type',
          items: [
            { value: 'individual', label: 'Individual' },
            { value: 'business', label: 'Business' },
          ],
        }),
      ],
      onSubmission: [
        submitTransition({
          validate: true,
          onValid: {
            next: [
              {
                when: Answer('type').match(Condition.MatchesValue('individual')),
                goto: '/individual-details',
              },
              {
                when: Answer('type').match(Condition.MatchesValue('business')),
                goto: '/business-details',
              },
            ],
          },
          onInvalid: { next: [{ goto: '/applicant-type' }] },
        }),
      ],
    }),
    // Separate paths for different types
    step({ path: '/individual-details', /* ... */ }),
    step({ path: '/business-details', /* ... */ }),
  ],
})
```

### 3. Multi-Step with Summary
Collect data across multiple steps, then review:

```typescript
journey({
  code: 'application',
  steps: [
    step({ path: '/personal', /* ... */ }),
    step({ path: '/employment', /* ... */ }),
    step({ path: '/financial', /* ... */ }),
    // Save as draft for each step
    step({
      path: '/review',
      entry: true,  // Allow returning to review
      blocks: [
        // Summary of all collected data
        // With change links back to each section
      ],
      onSubmission: [
        submitTransition({
          when: Post('action').match(Condition.MatchesValue('submit')),
          validate: false,  // No validation needed on review
          onAlways: {
            effects: [Effect.save()], // Commit to saved.
            next: [{ goto: '/confirmation' }],
          },
        }),
      ],
    }),
  ],
})
```

## Best Practices

### 1. Path Naming
Use clear, hierarchical paths that reflect the journey structure:

```typescript
// Good
'/personal-details'
'/contact/address'
'/payment/card-details'

// Avoid
'/step1'
'/page2'
'/form_part_3'
```

### 2. Entry Points
Mark appropriate steps as entry points for better user experience:

```typescript
// Allow users to return to summary without re-doing the form
step({
  path: '/summary',
  entry: true,
  checkJourneyTraversal: false,  // Don't enforce traversal for entry points
})
```


### 3. Journey Traversal
Use `checkJourneyTraversal` to enforce flow integrity where needed:

```typescript
// Enforce for sensitive steps
step({
  path: '/payment',
  checkJourneyTraversal: true,  // Must follow proper flow
})

// Skip for informational pages
step({
  path: '/help',
  checkJourneyTraversal: false,  // Can access directly
})
```
