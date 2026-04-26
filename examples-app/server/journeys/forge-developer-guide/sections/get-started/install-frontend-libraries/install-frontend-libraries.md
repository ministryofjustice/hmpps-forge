---
title: Install frontend libraries
section: get-started
path: get-started/install-frontend-libraries
teaches: [govuk-frontend, moj-frontend, frontend-libraries]
prerequisites: [installation]
---

<p class="govuk-caption-xl">Get started</p>

# Install frontend libraries
The provided Express and Nunjucks adapter renders components using
the GOV.UK Frontend and MOJ Frontend template libraries. Install
these packages so that your application can produce styled,
accessible markup.

{{slot:toc}}

---

## GOV.UK Frontend

GOV.UK Frontend provides the Design System components, styles, and
page templates used across government services. The Nunjucks adapter
uses its macros to render components like text inputs, radios,
buttons, and error summaries.

```bash
npm install govuk-frontend
```

You will also need to serve the GOV.UK Frontend static assets (CSS,
fonts, and images) and create a base page layout. The
[GOV.UK Frontend documentation](https://frontend.design-system.service.gov.uk/installing-with-npm/)
covers this in detail.

---

## MOJ Frontend

MOJ Frontend extends the GOV.UK Design System with components
specific to Ministry of Justice services, such as side navigation,
timeline, and multi-select filters.

```bash
npm install @ministryofjustice/frontend
```

MOJ Frontend is optional. If your service only uses GOV.UK Design
System components, you do not need to install it. However, most
HMPPS services include it.

---

## How these packages are used

These packages provide **templates** that the framework adapter uses
to render component HTML on the server. Forge itself does not import
CSS or JavaScript from them.

When you configure Nunjucks in the next guide, you will point it at
the template directories inside these packages. When you register
component libraries with Forge, it maps your journey definitions to
the correct templates.

The CSS and client-side JavaScript remain your responsibility to
serve. This keeps Forge's concerns separate from your asset pipeline.

---

## What is next

You now have all the packages Forge needs. Continue to
[Using Forge in your app](using-forge-in-your-app) to create a Forge
instance and register your component libraries.
