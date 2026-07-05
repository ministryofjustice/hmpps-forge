---
title: Creating your first journey
section: get-started
path: get-started/creating-your-first-journey
teaches: []
prerequisites: [installation, Forge, createExpressRouter]
---

<p class="govuk-caption-xl">Get started</p>

# Creating your first journey
Build a simple feedback form, register it with Forge, and see it
running in the browser.

{{slot:toc}}

---

## Define a journey

A journey is a data structure that describes a multi-page experience. Here
is one with three steps: a name page, a feedback page, and a
confirmation page.

```typescript
import { journey, step, submit, redirect } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKTextInput,
  GovUKTextareaInput,
  GovUKButton,
  GovUKPanel,
} from '@ministryofjustice/hmpps-forge/govuk-components'

const nameStep = step({
  path: '/',
  title: 'What is your name?',
  reachability: { entryWhen: true },
  blocks: [
    GovUKTextInput({
      code: 'fullName',
      label: {
        text: 'What is your name?',
        isPageHeading: true,
        classes: 'govuk-label--l',
      },
    }),
    GovUKButton({ text: 'Continue' }),
  ],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        next: [redirect({ goto: 'your-feedback' })],
      },
    }),
  ],
})

const feedbackStep = step({
  path: '/your-feedback',
  title: 'Your feedback',
  blocks: [
    GovUKTextareaInput({
      code: 'feedback',
      label: {
        text: 'Your feedback',
        isPageHeading: true,
        classes: 'govuk-label--l',
      },
      hint: { text: 'Tell us what you think of this service.' },
    }),
    GovUKButton({ text: 'Send feedback' }),
  ],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        next: [redirect({ goto: 'confirmation' })],
      },
    }),
  ],
})

const confirmationStep = step({
  path: '/confirmation',
  title: 'Feedback sent',
  blocks: [
    GovUKPanel({ titleText: 'Feedback sent' }),
  ],
})

export const feedbackJourney = journey({
  code: 'feedback',
  title: 'Give feedback',
  path: '/feedback',
  view: { template: 'partials/form-step' },
  steps: [nameStep, feedbackStep, confirmationStep],
})
```

Each step declares its URL path, a title, and the blocks that make up
the page content. The `reachability: { entryWhen: true }` property on the first step marks
it as the starting page.

The `onSubmission` hooks define what happens when the user submits
each step. Here they validate the input and redirect to the next step.

---

## How the pieces fit together

The journey produces the following routes:

```
journey({ path: '/feedback', ... })
├── step({ path: '/' })              → GET/POST /feedback
├── step({ path: '/your-feedback' }) → GET/POST /feedback/your-feedback
└── step({ path: '/confirmation' })  → GET/POST /feedback/confirmation
```

The `view.template` property tells the framework adapter which
template to use when rendering each step.

---

## Create a package

Forge needs journeys bundled into packages before they can be
registered. Create an `index.ts` alongside your journey file:

```typescript
import { createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'
import { feedbackJourney } from './journey'

export default createForgePackage({
  journey: feedbackJourney,
})
```

A package brings together the journey definition with any custom
functions and components it depends on. For this example, the journey
definition is all you need.

---

## Register the package

Import the package and register it with your Forge instance before
mounting the router:

```typescript
import feedbackPackage from './journeys/feedback'

forge.registerPackage(feedbackPackage)

app.use(express.urlencoded({ extended: true }))
app.use(createExpressRouter(forge, { nunjucksEnv }))

app.listen(3000, () => {
  console.log('Server running at http://localhost:3000')
})
```

---

## See it running

Start your application and open `http://localhost:3000/feedback`.
You should see the name page rendered with GOV.UK styling.

Fill in the field and select **Continue**. You will move through the
feedback page to the confirmation panel.

---

## What you have built

With a journey definition and a package file, you have a working
multi-page journey that:

- renders pages with GOV.UK Design System components
- handles form submission and redirects between steps
- repopulates submitted values when a step re-renders after a
  failed validation
- produces accessible, standards-compliant HTML

---

## Going further

This journey does not yet validate user input or persist data. To build
on what you have:

- [Validation](../building-journeys/validation) explains how to add
  rules that check input before allowing submission.
- [Hooks and lifecycle](../building-journeys/hooks-and-lifecycle)
  covers the request pipeline and where to run custom logic.
- [Loading, saving and redirecting](../building-journeys/loading-saving-and-redirecting)
  shows common patterns for persisting data.

For a complete guide to everything Forge offers, continue to
[Building journeys](../building-journeys).
