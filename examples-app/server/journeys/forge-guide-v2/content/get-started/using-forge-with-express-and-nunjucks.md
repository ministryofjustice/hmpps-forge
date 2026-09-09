---
title: Using Forge with Express and Nunjucks
slug: using-forge-with-express-and-nunjucks
section: get-started
path: get-started/using-forge-with-express-and-nunjucks
nav: Installation
order: 11
description: Create the Express router, a page template, and wire Forge into your application
teaches: [createExpressRouter, page-template]
prerequisites: [Forge, registerGlobalComponents]
---

# Using Forge with Express and Nunjucks

Forge ships with a framework adapter for Express and Nunjucks. This page covers creating the router, writing a page template, and mounting everything into a working application.

## Create the Express router

Pass your Forge instance and Nunjucks environment to `createExpressRouter` to produce an Express router:

```typescript
import { createExpressRouter } from '@ministryofjustice/hmpps-forge/express-nunjucks'

const router = createExpressRouter(forge, { nunjucksEnv })
```

## Create a page template

The adapter renders each step using a Nunjucks template that you provide. By default it looks for a template called `form-step.njk` in your Nunjucks search paths:

```nunjucks [[1, 5, "csrfToken"], [2, 6, "blocks"]]
{% extends "layout.njk" %}

{% block content %}
  <form method="post" novalidate>
    <input type="hidden" name="_csrf" value="{{ csrfToken }}">
    {% for block in blocks %}
      {{ block | safe }}
    {% endfor %}
  </form>
{% endblock %}
```

The template reads two values from the context:

- <s1>**csrfToken**</s1> - the adapter merges `app.locals`, `res.locals`, and any custom `req.state` into the template context, so values set by your middleware are available alongside Forge's own context. Here, `csrfToken` comes from CSRF middleware that sets `res.locals.csrfToken`.
- <s2>**blocks**</s2> - the rendered HTML for each block in the step.

## Set up middleware and mount the router

Your Express application needs body-parsing middleware so that form submissions can be read. Mount it before the Forge router:

```typescript
app.use(express.urlencoded({ extended: true }))
app.use(router)
```

Place the Forge router after any middleware but before your error handlers.

## What's next

Your application is configured and ready to serve journeys.
