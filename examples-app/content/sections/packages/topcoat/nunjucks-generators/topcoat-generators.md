---
title: Nunjucks Generators
section: packages
path: packages/topcoat/nunjucks-generators
teaches: [generators::string, nunjucks_functions]
prerequisites: [topcoat]
---

<p class="govuk-caption-xl">Topcoat Adapter</p>

# Nunjucks Generators
The `forge_runjucks` crate provides `generators::string`, a
generator for inline Nunjucks template composition. It lets you use
Nunjucks syntax directly inside block properties to produce
dynamic HTML strings.

{{slot:toc}}

---

## generators::string

Use `forge_runjucks::generators::string` to render a Nunjucks template
inline within a block property. The `data` object maps template
variables to Forge expressions, which are resolved before the
template runs:

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_runjucks::generators;

generators::string(obj! {
    "template": "<p>Hello, {{ name }}. You have {{ count }} items.</p>",
    "data": obj! {
        "name": answer("full-name"),
        "count": data("itemCount"),
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
following tags are **not allowed**: `generators::string` panics
when the definition is built, before any request is served:

- `{% import %}` / `{% from %}`
- `{% include %}`
- `{% extends %}`
- `{% macro %}`

These tags are rejected because they reach outside the template
via the loader or define reusable fragments.
`generators::string` is meant for inline display
composition - if you need reusable composition logic, extract a
custom generator or component instead.

---

## Registering the generators

The generator has two parts: the authoring-time helper
(`generators::string`) and the runtime implementation. You
need to register the implementation so the runtime can execute
it:

```rust
forge.register_global_functions(forge_runjucks::nunjucks_functions())?;
```

This registers all generator and function implementations from
the package in one call. Register them before any packages
whose journeys use the generator - `register_package` validates
function references during compilation, so a journey that uses
`generators::string` without the implementations registered
fails at registration time with a
`ForgeError::UnregisteredFunction`.
