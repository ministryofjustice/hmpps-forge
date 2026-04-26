---
title: Nunjucks Generators
section: packages
path: packages/express-nunjucks/nunjucks-generators
teaches: [NunjucksGenerators, NunjucksGenerators.String, nunjucksFunctions, nunjucksGeneratorImplementations]
prerequisites: [express-nunjucks]
---

<p class="govuk-caption-xl">Express-Nunjucks Adapter</p>

# Nunjucks Generators
The package provides `NunjucksGenerators.String`, a generator
for inline Nunjucks template composition. It lets you use
Nunjucks syntax directly inside block properties to produce
dynamic HTML strings.

{{slot:toc}}

---

## NunjucksGenerators.String

Use `NunjucksGenerators.String` to render a Nunjucks template
inline within a block property. The `data` object maps template
variables to Forge expressions, which are resolved before the
template runs:

```typescript
import { Answer, Data } from '@ministryofjustice/hmpps-forge/core/authoring'
import { NunjucksGenerators } from '@ministryofjustice/hmpps-forge/express-nunjucks'

NunjucksGenerators.String({
  template: '<p>Hello, {{ name }}. You have {{ count }} items.</p>',
  data: {
    name: Answer('full-name'),
    count: Data('itemCount'),
  },
})
```

Values interpolated via `{{ name }}` are HTML-escaped
automatically. Use `{{ name | safe }}` when the value is
trusted HTML.

### What you can use

Templates support standard Nunjucks constructs for display
composition:

- **Variable interpolation** - `{{ name }}`
- **Filters** - `{{ value | upper }}`
- **Conditionals** - `{% if condition %}...{% endif %}`
- **Loops** - `{% for item in items %}...{% endfor %}`
- **Variable assignment** - `{% set variable = value %}`

---

## Forbidden tags

Templates are restricted to inline display composition. The
following tags are **not allowed** and will throw an error at
journey-definition time, before any request is served:

- `{% import %}` / `{% from %}`
- `{% include %}`
- `{% extends %}`
- `{% macro %}`

These tags are rejected because they reach outside the template
via the loader or define reusable fragments.
`NunjucksGenerators.String` is meant for inline display
composition - if you need reusable composition logic, extract a
custom generator or component instead.

---

## Registering the generators

The generator has two parts: the authoring-time namespace
(`NunjucksGenerators`) and the runtime implementations. You
need to register the implementations so the runtime can execute
them:

```typescript
import { nunjucksFunctions } from '@ministryofjustice/hmpps-forge/express-nunjucks'

forge.registerGlobalFunctions(nunjucksFunctions)
```

This registers all generator and function implementations from
the package in one call. Without this, any journey that uses
`NunjucksGenerators.String` will fail at runtime.