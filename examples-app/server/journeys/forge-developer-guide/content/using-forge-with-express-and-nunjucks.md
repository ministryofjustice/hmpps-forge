---
title: Using Forge with Express and Nunjucks
section: get-started
path: get-started/using-forge-with-express-and-nunjucks
teaches: [ExpressFrameworkAdapter, getRouter, nunjucks-setup, page-template]
prerequisites: [Forge, registerGlobalComponents]
---

<p class="govuk-caption-xl">Get started</p>

# Using Forge with Express and Nunjucks
Forge ships with a framework adapter for Express and Nunjucks. This
guide covers how to configure it and wire everything into a working
application.

{{slot:toc}}

---

## Configure Nunjucks

The Express adapter uses Nunjucks as its template engine. When you
configure Nunjucks, include the template directories for
`govuk-frontend`, `@ministryofjustice/frontend`, and Forge's own
component templates:

```typescript
import nunjucks from 'nunjucks'
import express from 'express'
import path from 'node:path'

const app = express()

const nunjucksEnv = nunjucks.configure(
  [
    path.join(__dirname, 'views'),
    'node_modules/govuk-frontend/dist/',
    'node_modules/@ministryofjustice/frontend/',
    'node_modules/@ministryofjustice/hmpps-forge/dist/govuk-components/',
    'node_modules/@ministryofjustice/hmpps-forge/dist/moj-components/',
  ],
  {
    autoescape: true,
    express: app,
  },
)
```

The order of directories matters. Your own `views/` directory comes
first so your templates can override defaults when needed.

---

## Create the framework adapter

Pass the Nunjucks environment to `ExpressFrameworkAdapter` and use it
when creating your Forge instance:

```typescript
import { Forge } from '@ministryofjustice/hmpps-forge/core'
import { ExpressFrameworkAdapter } from '@ministryofjustice/hmpps-forge/express-nunjucks'

const forge = new Forge({
  frameworkAdapter: ExpressFrameworkAdapter.configure({ nunjucksEnv }),
})
```

---

## Create a page template

The adapter renders each step using a Nunjucks template that you
provide. Create a file at `server/views/partials/form-step.njk`:

```nunjucks
{% extends "partials/layout.njk" %}

{% block content %}
  <div class="govuk-grid-row">
    <div class="govuk-grid-column-two-thirds">
      {% if fieldValidationErrors | length %}
        {{ govukErrorSummary({
          titleText: "There is a problem",
          errorList: fieldValidationErrors
        }) }}
      {% endif %}

      <form method="post" novalidate>
        <input type="hidden" name="_csrf" value="{{ csrfToken }}">
        {% for block in blocks %}
          {{ block | safe }}
        {% endfor %}
      </form>
    </div>
  </div>
{% endblock %}
```

The adapter passes three things to this template:

- **blocks**: the rendered HTML for each block in the step
- **fieldValidationErrors**: any validation errors to display in the
  error summary
- **csrfToken**: a CSRF token for form security

This template extends your base layout. If you do not already have a
`layout.njk`, see the
[GOV.UK Frontend documentation](https://frontend.design-system.service.gov.uk/installing-with-npm/#get-the-template-working)
for setting up a page template.

---

## Set up middleware and mount the router

Your Express application needs body parsing middleware so that form
submissions can be read. Mount this before the Forge router:

```typescript
app.use(express.urlencoded({ extended: true }))
app.use(forge.getRouter())
```

Place the Forge router after any middleware but before your error
handlers.

---

## Putting it together

Here is a minimal `app.ts` with all the pieces in place:

```typescript
import express from 'express'
import nunjucks from 'nunjucks'
import path from 'node:path'
import { Forge } from '@ministryofjustice/hmpps-forge/core'
import { ExpressFrameworkAdapter } from '@ministryofjustice/hmpps-forge/express-nunjucks'
import { govukComponents } from '@ministryofjustice/hmpps-forge/govuk-components'
import { mojComponents } from '@ministryofjustice/hmpps-forge/moj-components'

const app = express()

// Template engine
const nunjucksEnv = nunjucks.configure(
  [
    path.join(__dirname, 'views'),
    'node_modules/govuk-frontend/dist/',
    'node_modules/@ministryofjustice/frontend/',
    'node_modules/@ministryofjustice/hmpps-forge/dist/govuk-components/',
    'node_modules/@ministryofjustice/hmpps-forge/dist/moj-components/',
  ],
  { autoescape: true, express: app },
)

// Forge
const forge = new Forge({
  frameworkAdapter: ExpressFrameworkAdapter.configure({ nunjucksEnv }),
})

forge.registerGlobalComponents(govukComponents)
forge.registerGlobalComponents(mojComponents)

// Register journey packages here
// forge.registerPackage(myPackage)

// Middleware and routes
app.use(express.urlencoded({ extended: true }))
app.use(forge.getRouter())

app.listen(3000, () => {
  console.log('Server running at http://localhost:3000')
})
```

---

## What is next

Your application is configured and ready to serve journeys. Continue
to [Creating your first journey](creating-your-first-journey) to define
a journey and see it running in the browser.
