---
title: Install frontend libraries
slug: install-frontend-libraries
section: get-started
path: get-started/install-frontend-libraries
nav: Installation
order: 12
description: Install GOV.UK Frontend and MOJ Frontend so Forge can render components
teaches: [govuk-frontend, moj-frontend, frontend-libraries]
prerequisites: [installation]
---

# Install frontend libraries

The Express and Nunjucks adapter renders components using the GOV.UK Frontend and MOJ Frontend template libraries. This page covers installing those packages and pointing Nunjucks at their templates.

## GOV.UK Frontend

GOV.UK Frontend provides the Design System components, styles, and page templates used across government services. The Nunjucks adapter uses its macros to render components like text inputs, radios, buttons, and error summaries.

```bash
npm install govuk-frontend
```

You'll also need to serve the GOV.UK Frontend static assets (CSS, fonts, and images) and create a base page layout. The [GOV.UK Frontend documentation](https://frontend.design-system.service.gov.uk/installing-with-npm/) covers this in detail.

Add the GOV.UK Frontend template directory and Forge's GOV.UK component templates to your Nunjucks configuration:

```typescript
nunjucks.configure([
  // ...
  'node_modules/govuk-frontend/dist/',
  'node_modules/@ministryofjustice/hmpps-forge/dist/govuk-components/',
])
```

The GOV.UK components package also exports Nunjucks globals that your page templates can use. Register them after configuring the Nunjucks environment:

```typescript
import { registerForgeGovUKComponentsGlobals } from '@ministryofjustice/hmpps-forge/govuk-components'

registerForgeGovUKComponentsGlobals(nunjucksEnv)
```

With those globals registered, your page template can use GOV.UK components like the error summary alongside Forge's rendered blocks. Here's a GOV.UK-flavoured version of the page template:

```nunjucks [[1, 7, "getErrorSummaryList()"]]
{% extends "layout.njk" %}
{% from "govuk/components/error-summary/macro.njk" import govukErrorSummary %}

{% block content %}
  <div class="govuk-grid-row">
    <div class="govuk-grid-column-two-thirds">
      {% set errorList = getErrorSummaryList() %}
      {% if errorList.length %}
        {{ govukErrorSummary({
          titleText: "There is a problem",
          errorList: errorList
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

<s1>`getErrorSummaryList()`</s1> is one of the globals registered above. It reads the step's validation errors from the template context and converts them into the `{ text, href }` shape that `govukErrorSummary` expects.

## MOJ Frontend

MOJ Frontend extends the GOV.UK Design System with components specific to Ministry of Justice services, such as side navigation, timeline, and multi-select filters.

```bash
npm install @ministryofjustice/frontend
```

MOJ Frontend is optional. If your service only uses GOV.UK Design System components, you don't need to install it.

Add the MOJ Frontend template directory and Forge's MOJ component templates to your Nunjucks configuration:

```typescript
nunjucks.configure([
  // ...
  'node_modules/@ministryofjustice/frontend/',
  'node_modules/@ministryofjustice/hmpps-forge/dist/moj-components/',
])
```

## What's next

You now have the frontend packages installed and their templates configured. Continue to [Using Forge with Express and Nunjucks](using-forge-with-express-and-nunjucks) to create the router, page template, and middleware that connect Forge to your application.
