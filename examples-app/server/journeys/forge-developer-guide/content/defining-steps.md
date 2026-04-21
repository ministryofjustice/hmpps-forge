---
title: Defining steps
section: building-journeys
path: building-journeys/defining-steps
teaches: [step, StepDefinition, view-inheritance, backlink, cleardownFieldCodes, step-data, step-code]
prerequisites: [journey, JourneyDefinition, block, BlockDefinition]
---

<p class="govuk-caption-xl">Building flows and content</p>

# Defining steps

A step is a single page within a journey. It defines what users see
and how they interact with it: the content, the fields, and the
behaviour that runs when they arrive or submit.

{{slot:toc}}

---

## What is a step?

Where a journey describes the overall structure of a multi-page
experience, a step describes a single screen: what blocks appear on
it, what data it needs, and how it looks.

```typescript
import { step } from '@ministryofjustice/hmpps-forge/core/authoring'

const addTripStep = step({
  path: '/add-trip',
  title: 'Add a trip',
  blocks: [heading, countryField, departureDateField, continueButton],
})
```

Like journeys, steps are declarations. A step does not execute anything
or hold state. It describes what a page looks like and what it needs.
Forge takes that definition, mounts a route for it, and handles the
rendering and request lifecycle.

Steps always belong to a journey. They are passed into the journey's
`steps` array, and their route is built by joining the step's `path`
with the parent journey's `path`:

```typescript
journey({
  path: '/travel-declaration',
  steps: [addTripStep],  // → GET/POST /travel-declaration/add-trip
})
```

---

## How it works

When Forge compiles a journey, it processes each step in three ways:

1. **Mounts routes**: registers a GET and POST handler at the composed
   path. A step at `/add-trip` inside a journey at `/travel-declaration`
   becomes `/travel-declaration/add-trip`.
2. **Inherits configuration**: any `view` or `data` set on the parent
   journey flows down to the step. The step can override either.
3. **Registers in the navigation tree**: the step's `title`, `path`,
   and `metadata` are extracted into the
   [navigation tree](navigation-tree) so templates can render sidebars
   and breadcrumbs.

### Configuration inheritance

Configuration flows downward from journey to step. A `view` set on
the journey applies to every step unless a step provides its own
override.

```typescript
const travelJourney = journey({
  path: '/travel-declaration',
  view: {
    template: 'partials/form-page',
    locals: { serviceName: 'Declare your overseas travel' },
  },
  steps: [addTripStep, checkAnswersStep],
})
```

Both `addTripStep` and `checkAnswersStep` inherit the template and
locals. If `checkAnswersStep` needs a different template, it sets its
own `view`:

```typescript
const checkAnswersStep = step({
  path: '/check-answers',
  title: 'Check your travel declaration',
  view: { template: 'partials/check-answers' },
  blocks: [heading, overviewSummary, tripSummaryCards, submitButton],
})
```

The same inheritance applies to `data`. Static data set on a journey
is available to all its steps through `Data()` expressions. A step
can add its own data, which merges with the journey data for that
step only.

---

## Organising step files

As a step grows, it helps to separate the step definition from its
blocks. A common pattern is to give each step its own directory:

```
travel-declaration/
├── journey.ts
└── steps/
    ├── add-trip/
    │   ├── step.ts
    │   └── blocks.ts
    ├── your-trips/
    │   ├── step.ts
    │   └── blocks.ts
    └── check-answers/
        ├── step.ts
        └── blocks.ts
```

The step file defines the structure and hooks. The blocks file
defines the content and fields:

```typescript
// steps/add-trip/blocks.ts
import {
  GovUKHeading,
  GovUKButton,
  GovUKSelectInput,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const heading = GovUKHeading({ text: 'Add a trip', size: 'l' })

export const countryField = GovUKSelectInput({
  code: 'tripCountry',
  label: { text: 'Which country did you visit?' },
  items: Data('countries'),
})

export const continueButton = GovUKButton({ text: 'Save and continue' })
```

```typescript
// steps/add-trip/step.ts
import { step, submit, redirect } from '@ministryofjustice/hmpps-forge/core/authoring'
import { heading, countryField, continueButton } from './blocks'

export const addTripStep = step({
  path: '/add-trip',
  title: 'Add a trip',
  data: { countries },
  blocks: [heading, countryField, continueButton],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        next: [redirect({ goto: 'your-trips' })],
      },
    }),
  ],
})
```

This is a convention, not a requirement. Small steps with one or two
blocks work fine in a single file.

---

## Step properties

### `path` (Required)

The URL path segment for this step. Joined with the parent journey's
path to produce the full route.

```typescript
path: '/add-trip'
```

Paths must start with `/` and must be unique within the journey. If
two steps produce the same composed route, Forge fails with a
`DuplicateRouteError` at mount time.

Paths can include route parameters:

```typescript
path: '/prisoner/:prisonerId'
```

### `title` (Required)

The display name for the step. Used in the navigation tree, the page
title, and anywhere the step needs a human-readable label.

```typescript
title: 'Add a trip'
```

### `code` (Optional)

A unique identifier for the step. Useful for programmatic references
where you need to identify a step without relying on its path.

```typescript
code: 'add-trip'
```

### `blocks` (Optional)

An array of block and field definitions that make up the page content.
The order in the array is the order on the page. See
[Defining blocks and fields](defining-blocks-and-fields) for how
blocks and fields work.

```typescript
blocks: [heading, countryField, departureDateField, continueButton]
```

### `view` (Optional)

Controls rendering behaviour for this step. Overrides any `view` set
on the parent journey.

```typescript
view: {
  template: 'partials/confirmation-page',
  locals: { showBackLink: false },
}
```

| Property   | Description                                 |
|------------|---------------------------------------------|
| `template` | Template to use for rendering this step     |
| `locals`   | Arbitrary properties passed to the template |

### `backlink` (Optional)

Sets a custom back link URL. By default, Forge provides a back link
based on the user's navigation history. Set a custom URL to override
this, or an empty string to remove the back link entirely.

```typescript
backlink: '/travel-declaration/your-trips'  // Custom URL
backlink: ''                                // No back link
```

### `reachability` (Optional)

Marks the step as an entry point and configures tie-breaking behaviour.
`entryWhen` can be `true` (always an entry point) or a condition
expression (entry point only when the condition is met). `tieBreakers`
resolves ambiguity when Forge has multiple candidates - entry points,
paths to a step, or redirect targets.

```typescript
reachability: { entryWhen: true }
reachability: { entryWhen: Session('submitted').match(Condition.Equals(true)) }
reachability: { entryWhen: true, tieBreakers: [tieBreaker({ priority: 100 })] }
```

See [Routing and entry points](routing-and-entry-points) for how entry
points work, and [Reachability](reachability) for the redirect logic.

### `data` (Optional)

Static data attached to the step, available in blocks through `Data()`
expressions. Merged with any data set on the parent journey, where
step values take precedence when keys overlap.

```typescript
data: {
  countries: [
    { value: 'FR', text: 'France' },
    { value: 'DE', text: 'Germany' },
  ],
}
```

```typescript
// In a block:
GovUKSelectInput({
  code: 'country',
  items: Data('countries'),
})
```

### `metadata` (Optional)

Arbitrary data passed through to the navigation tree. Forge does not
use it internally. See [The navigation tree](navigation-tree) for how
to use metadata for grouping and display.

```typescript
metadata: { navGroup: 'Core concepts', hiddenFromNav: true }
```

### `cleardownFieldCodes` (Optional)

An array of field codes to clear when this step becomes unreachable.
Prevents stale answers from lingering when a user changes their path
through the journey. Supports exact field codes and regex patterns.

```typescript
cleardownFieldCodes: ['tripCountry', 'tripDepartureDate', '^trip.*$']
```

### `onAccess`, `onAction`, `onSubmission` (Optional)

Lifecycle hooks that run at different points in the request cycle.
These control data loading, in-page actions, and form submission.
See [Hooks and lifecycle](hooks-and-lifecycle) for full details.

### `validWhen` (Optional)

Step-level validation rules that run alongside field-level validations.
Useful for cross-field rules that depend on multiple inputs. See
[Validation](validation).

---

## Best practices

- **Keep steps focused on a single task.** "Add a trip" is one step.
  "Review your trips" is another. If a step has more than 7 or 8
  fields, consider whether it should be split.
- **Separate blocks into their own file when a step grows.** The step
  file should read like a summary: path, title, blocks, hooks.
  Move the block definitions next door.
- **Set `view` at the journey level, override at the step level.** Most
  steps in a journey share the same template. Only override where a
  step genuinely needs something different, like a confirmation page.
- **Use `data` for static values, effects for dynamic values.** A list
  of countries that never changes belongs in `data`. A list loaded from
  an API belongs in an access hook effect.
- **Use `code` when you need to reference a step programmatically.**
  Paths can change during development. Codes provide a stable handle.
