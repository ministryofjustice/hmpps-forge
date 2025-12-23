# Journeys and Steps

Forms are built from journeys and steps. A journey is the top-level container that defines the form's identity and configuration. Steps are the individual pages within a journey.

## What is a Journey?

A journey is the root structure for a form. It defines:

- A unique identifier (`code`) for the form
- The base URL path where the form lives
- Configuration for rendering and behaviour
- The steps that make up the form flow
- Optional child journeys for nested structures

### Import

```typescript
import { journey, step } from '@form-engine/form/builders'
```

---

## What is a Step?

A step is a single page within a journey. Each step:

- Has its own URL path (relative to the journey)
- Contains blocks for displaying content
- Contains fields for collecting user input
- Can handle form submissions and navigation

---

## The Hierarchy

Forms follow a strict containment hierarchy:

```
Journey
├── Step
│     ├── Block (display content)
│     ├── Field (collect input)
│     └── Field
├── Step
│     └── Block
└── Child Journey (optional)
      └── Step
            └── Block
```

### Path Composition

URLs are composed by concatenating journey and step paths:

```
/forms/food-business-registration/personal-details
       └── journey.path ─────────┘└── step.path ──┘
```

---

## Journey Properties

### `code` (Required)

Unique identifier for the journey. Used for storing and looking up form instances:

```typescript
code: 'food-business-registration'
```

### `path` (Required)

URL path segment for the journey. All steps are prefixed with this path:

```typescript
path: '/food-business-registration'
```

### `title` (Required)

Human-readable title. Used in navigation, progress indicators, and page titles:

```typescript
title: 'Register a Food Business'
```

### `steps` (Optional)

Array of step definitions that make up the journey:

```typescript
steps: [
  welcomeStep,
  personalDetailsStep,
  businessDetailsStep,
  reviewStep,
]
```

### `children` (Optional)

Array of child journeys for nested structures. Child paths are prefixed with the parent path:

```typescript
children: [
  journey({
    code: 'business-details',
    title: 'Business Details',
    path: '/business-details',
    steps: [/* ... */],
  }),
]
```

### `entryPath` (Optional)

Override the default entry point. When users navigate to the journey root, they're redirected here:

```typescript
entryPath: '/welcome'
```

**Resolution priority:**
1. `entryPath` on the journey (if specified)
2. First step with `isEntryPoint: true`

### `view` (Optional)

Configuration for how the journey renders:

```typescript
view: {
  template: 'partials/form-step',
  locals: {
    serviceName: 'Food Business Registration',
    showProgress: true,
  },
}
```

Steps inherit this configuration unless they override it.

### `metadata` (Optional)

Custom data for application-specific logic:

```typescript
metadata: {
  version: '1.0',
  category: 'registration',
  requiresAuth: true,
}
```

### `data` (Optional)

Static data available to this journey and all its steps via `Data()` references. This data is merged into the evaluation context before any lifecycle transitions run:

```typescript
data: {
  serviceName: 'Food Business Registration',
  supportEmail: 'support@example.com',
  maxFileSize: 10485760,
}
```

Accessing in expressions using `Data()`:

```typescript
Format('Contact us at {0}', Data('supportEmail'))
```

Accessing in effects using `context.getData()`:

```typescript
Effect(: async (context) => {
  const email = context.getData('supportEmail')
  // ...
}),
```

**Inheritance:** Step `data` is shallow-merged with journey `data`, with step values taking precedence.

### `onLoad`, `onAccess` (Optional)

Journeys can define `onLoad` and `onAccess` transitions that run for every step. See [Transitions](./transitions.md).

---

## Step Properties

### `path` (Required)

URL path segment for this step. Combined with the journey path:

```typescript
path: '/personal-details'
```

### `title` (Required)

Human-readable title for the step:

```typescript
title: 'Enter your personal details'
```

### `blocks` (Required)

Array of block and field definitions. See [Blocks and Fields](./blocks-and-fields.md):

```typescript
blocks: [
  block<HtmlBlock>({
    variant: 'html',
    content: '<h1>Welcome</h1>',
  }),
  field<GovUKTextInput>({
    variant: 'govukTextInput',
    code: 'fullName',
    label: 'Full name',
  }),
]
```

### `isEntryPoint` (Optional)

Marks this step as an entry point. Entry points are exempt from reachability validation and the first entry point becomes the default redirect for the journey root:

```typescript
isEntryPoint: true
```

Multiple steps can have `isEntryPoint: true` - useful for hub-and-spoke patterns.

### `view` (Optional)

Override the journey's view configuration for this step:

```typescript
view: {
  template: 'partials/confirmation-page',
  locals: {
    showConfetti: true,
  },
}
```

### `backlink` (Optional)

Override the default back link. By default, steps show a back link to the previous step:

```typescript
// Custom URL
backlink: '/forms/my-journey/previous-section'

// Disable back link
backlink: ''
```

### `metadata` (Optional)

Custom data for this step:

```typescript
metadata: {
  section: 'personal-info',
  analyticsPageName: 'Personal Details Entry',
}
```

### `data` (Optional)

Static data available to this step via `Data()` references. Merged with inherited journey data (step values take precedence):

```typescript
data: {
  pageHeading: 'Enter your personal details',
  maxItems: 5,
}
```

See the journey `data` property for usage examples.

### `onLoad`, `onAccess`, `onAction`, `onSubmission` (Optional)

Steps can define these lifecycle transitions. See [Transitions](./transitions.md).

---

## Basic Usage

### Simple Journey

```typescript
import { journey, step, block, field } from '@form-engine/form/builders'
import { HtmlBlock } from '@form-engine/registry/components/html'
import { GovUKTextInput, GovUKButton } from '@form-engine-govuk-components/components'

export default journey({
  code: 'contact-form',
  title: 'Contact Us',
  path: '/contact',

  steps: [
    step({
      path: '/details',
      title: 'Your Details',
      isEntryPoint: true,
      blocks: [
        block<HtmlBlock>({
          variant: 'html',
          content: '<h1 class="govuk-heading-l">Contact Us</h1>',
        }),
        field<GovUKTextInput>({
          variant: 'govukTextInput',
          code: 'name',
          label: 'Your name',
        }),
        field<GovUKTextInput>({
          variant: 'govukTextInput',
          code: 'email',
          label: 'Email address',
        }),
        block<GovUKButton>({
          variant: 'govukButton',
          text: 'Submit',
        }),
      ],
    }),
  ],
})
```

### Multi-Step Journey

```typescript
import { journey } from '@form-engine/form/builders'
import { personalDetailsStep } from './steps/personal-details'
import { businessDetailsStep } from './steps/business-details'
import { reviewStep } from './steps/review'
import { confirmationStep } from './steps/confirmation'

export default journey({
  code: 'food-business-registration',
  title: 'Register a Food Business',
  path: '/food-business-registration',

  view: {
    template: 'partials/form-step',
    locals: {
      serviceName: 'Food Business Registration',
    },
  },

  steps: [
    personalDetailsStep,
    businessDetailsStep,
    reviewStep,
    confirmationStep,
  ],
})
```

### Nested Journeys

```typescript
import { journey } from '@form-engine/form/builders'
import { hubStep } from './steps/hub'
import { personalSection } from './sections/personal'
import { businessSection } from './sections/business'

export default journey({
  code: 'registration',
  title: 'Registration',
  path: '/registration',

  steps: [hubStep],

  children: [
    personalSection,   // path: /registration/personal/...
    businessSection,   // path: /registration/business/...
  ],
})
```

---

## Best Practices

### Use Descriptive Paths

```typescript
// DO: Descriptive, kebab-case
path: '/personal-details'
path: '/business-address'

// DON'T: Vague or inconsistent
path: '/step1'
path: '/personalDetails'
```

### Organise Steps in Separate Files

For larger journeys, keep each step in its own file:

```
my-journey/
├── index.ts           # journey definition
├── effects.ts         # shared effects
└── steps/
    ├── personal-details.ts
    ├── business-details.ts
    └── review.ts
```

### Use Entry Points for Hub-and-Spoke

```typescript
// Hub step
step({
  path: '/hub',
  title: 'Task List',
  isEntryPoint: true,
  // ...
})

// Section steps - also entry points so users can bookmark them
step({
  path: '/personal',
  title: 'Personal Details',
  isEntryPoint: true,
  // ...
})
```
