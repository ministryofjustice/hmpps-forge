---
title: Rendering
section: packages
path: packages/express-nunjucks/rendering
teaches: [template-resolution, view-locals, template-context, NunjucksRenderer]
prerequisites: [express-nunjucks]
---

<p class="govuk-caption-xl">Express-Nunjucks Adapter</p>

# Rendering
When a step is ready to display, the `NunjucksRenderer` resolves a
Nunjucks template, renders each visible block to HTML, and assembles a
template context from journey data, answers, and Express locals.
This page covers each part of that process.

{{slot:toc}}

---

## Template resolution

The renderer resolves which Nunjucks template to use by checking
three places in order:

1. **The step itself** - if `view.template` is set on the step
   definition, that template is used.
2. **Ancestor journeys** - starting from the nearest parent and
   walking up, the first ancestor with a `view.template` wins.
3. **Default template** - falls back to the `defaultTemplate`
   option passed to `NunjucksRenderer`, or `'form-step'` if
   not configured.

The `.njk` extension is appended automatically if the template
name doesn't already end with it.

```typescript
// This step uses 'review-page.njk'
step({
  path: '/review',
  title: 'Review your answers',
  view: { template: 'review-page' },
  // ...
})

// This step inherits the template from its nearest ancestor
step({
  path: '/name',
  title: 'What is your name?',
  // no view.template - walks up to parent journey
  // ...
})
```

---

## View locals

Journeys and steps can declare `view.locals` - static values
that are merged into the template context at render time. The
renderer merges them in a specific order:

1. Ancestors merge first, from the root journey down to the
   immediate parent.
2. The step's own `view.locals` merge last, overriding any
   ancestor values with the same key.

```typescript
journey({
  code: 'my-journey',
  view: {
    template: 'guide-step',
    locals: { showBackToTop: true, sectionTitle: 'Forms' },
  },
  steps: [
    step({
      path: '/review',
      title: 'Review',
      view: {
        locals: { sectionTitle: 'Review' },
        // showBackToTop is inherited, sectionTitle is overridden
      },
    }),
  ],
})
```

---

## Template context

When the page template renders, the following variables are
available in the Nunjucks context:

| Variable | Type | Description |
|----------|------|-------------|
| `blocks` | `string[]` | Each visible block, already rendered to HTML. Use `{{ block \| safe }}` in your template. |
| `step` | object | The current step's metadata (`title`, `path`, `view`, etc.). |
| `ancestors` | object[] | The chain of parent journeys from root to immediate parent. |
| `routeTree` | object | Route hierarchy with resolved paths and active state. |
| `answers` | object | The user's answers for this journey. |
| `data` | object | Data set by effects (e.g. loaded content, API responses). |
| `fieldValidationErrors` | object[] | Field-level validation errors (after a POST). |
| `domainValidationErrors` | object[] | Domain-level validation errors (after a POST). |

### Express locals in the context

In addition to the variables above, `app.locals`, `res.locals`,
and merged `view.locals` are all spread into the template context.
This means values like CSRF tokens, service name, or environment
flags set by your Express middleware are available directly in the
template without any extra wiring:

```njk
{# res.locals.csrfToken is available directly #}
<input type="hidden" name="_csrf" value="{{ csrfToken }}">

{# view.locals.sectionTitle from the journey definition #}
<h2>{{ sectionTitle }}</h2>
```

### Rendering blocks

Blocks are rendered to HTML strings before the page template
runs. In your template, iterate over the `blocks` array and
output each one with the `safe` filter:

```njk
{% for block in blocks %}
  {{ block | safe }}
{% endfor %}
```

Only visible blocks are included - any block with
`visibleWhen` evaluating to `false` is filtered out before
rendering.

---

## Template caching

The renderer caches compiled Nunjucks templates internally.
The first time a template is rendered, it is compiled from the
Nunjucks environment and stored. Subsequent renders of the same
template reuse the compiled version. This applies to both page
templates and component templates.
