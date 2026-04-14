---
title: Get started
section: get-started
path: get-started
teaches: []
prerequisites: []
---

<p class="govuk-caption-xl">Get started</p>

# Get started
Forge is a stateless framework that lets you build multi-page flows declaratively.
You define your journeys as data structures and Forge handles routing, rendering, validation,
and navigation. It exists to simplify building user journeys, while still offering
the flexibility to handle complex flows

{{slot:toc}}

---

## What Forge gives you

Every multi-page journey has the same runtime concerns: routing,
page rendering, field state, validation, error summaries, conditional
logic, and navigation. Forge handles all of these so you can focus on
the structure and rules of your service.

You describe your journey declaratively:

```typescript
import { journey, step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKTextInput, GovUKButton } from '@ministryofjustice/hmpps-forge/govuk-components'

const myJourney = journey({
  code: 'my-form',
  title: 'My form',
  path: '/my-form',
  steps: [
    step({
      path: '/your-name',
      title: 'What is your name?',
      isEntryPoint: true,
      blocks: [
        GovUKTextInput({ code: 'fullName', label: { text: 'Full name' } }),
        GovUKButton({ text: 'Continue' }),
      ],
    }),
  ],
})
```

Forge takes that definition and produces a fully working flow of pages; handling
rendering, error handling, validation, reachability checks and navigation. And through hooks,
journey authors control how data flows in and out. This means Forge never dictates how your
service manages its data. How you interact with your integrations,
store answers, and retrieve data is entirely up to you.

---

## Where to start

Work through these guides in order. Each one builds on the previous.

1. [Installing Forge](installing-forge) covers installing the core npm
   package and its dependencies.
2. [Install frontend libraries](install-frontend-libraries) adds the
   GOV.UK and MOJ component packages.
3. [Using Forge in your app](using-forge-in-your-app) creates a Forge
   instance and registers component libraries.
4. [Using Forge with Express and Nunjucks](using-forge-with-express-and-nunjucks)
   covers configuring the provided framework adapter, templates, and
   routing.
5. [Creating your first journey](creating-your-first-journey) builds a
   working journey from scratch.

Once you have a running application, continue to
[Building journeys](../building-journeys) for a full guide to
defining steps, fields, routing, validation, and more.
