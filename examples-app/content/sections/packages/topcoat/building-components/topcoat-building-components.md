---
title: Building Components
section: packages
path: packages/topcoat/building-components
teaches: [nunjucks_render, ComponentEntry, component-rendering, validation-errors]
prerequisites: [topcoat, block]
---

<p class="govuk-caption-xl">Topcoat Adapter</p>

# Building Components
The `nunjucks_render` utility (from `forge_runjucks`) creates a
render function that renders a block using a Nunjucks template.
This is how the GOV.UK and MOJ component packages define their
components, and how you can build your own.

{{slot:toc}}

---

## Creating a component

A Nunjucks component maps a block variant to a render function
that returns HTML. `nunjucks_render` takes the template and a
function that builds the template's `params` from the block:

```rust
use forge_core::{ComponentEntry, Value, obj};
use forge_runjucks::nunjucks_render;

fn my_input_params(block: &Value) -> Value {
    obj! {
        "id": match block.get("id") {
            Value::Undefined | Value::Null => block.get("code"),
            id => id,
        },
        "name": block.get("code"),
        "label": obj! { "text": block.get("label") },
        "value": block.get("value"),
        "errorMessage": match block.get("errors").get("0") {
            Value::Undefined => Value::Undefined,
            error => obj! { "text": error.get("message") },
        },
    }
}

pub fn my_input() -> ComponentEntry {
    ComponentEntry::new("my-input").with_render(nunjucks_render("components/my-input.njk", my_input_params))
}
```

The render function `nunjucks_render` builds receives two
arguments:

1. **`block`** - the evaluated block, with all expressions
   resolved to concrete values, as a `Value`.
2. **`engine`** - the renderer's `RunjucksEngine` (passed as
   `&dyn Any`), backed by an internal template cache so repeated
   renders of the same template don't re-parse.

It renders the template with `{ params }` and returns the HTML
string. To render some other way, pass your own closure to
`with_render` and downcast the engine with
`engine.downcast_ref::<RunjucksEngine>()`.

---

## Registering components

Register your component with Forge so it can render blocks
that use the matching variant. To make it available to every
journey, pass it to `register_global_components`:

```rust
use crate::components::my_input;

forge.register_global_components([my_input()])?;
```

Alternatively, bundle it with a journey package with
`with_components()`:

```rust
use forge_core::ForgePackage;
use crate::components::my_input;

pub fn my_package() -> ForgePackage {
    ForgePackage::new(my_journey()).with_components([my_input()])
}

forge.register_package(my_package())?;
```

---

## Validation errors

When a form is submitted and validation fails, the engine
collects the failed results from each field's `validWhen`
validations and attaches them as an `errors` array on the
evaluated block:

```rust
// Each error has a message and optional details
block.get("errors")
// [{ "message": "Enter a valid date", "details": { ... } }]
```

Components check this array to render inline error messages
alongside form fields. When any field on the step has failed,
every field carries `errors` - its own failures, or an empty
array if it passed. When nothing failed, or the step has not
been submitted yet, the `errors` property is absent, so read
it defensively (`block.get("errors").get("0")` is undefined when
there is none).

Only failed validations are included - passing validations
are filtered out.

---

## Nested blocks

Some components accept other blocks as properties (for
example, a grid layout that contains child blocks in each
column). When the adapter encounters a nested block inside a
component's properties, it renders that block to HTML
automatically and provides the result as a rendered block:

```rust
// A rendered block
obj! {
    "block": obj! { "type": ..., "blockType": ..., "variant": ..., /* ...properties */ },
    "html": "<div>...</div>",
}
```

Your component receives the pre-rendered HTML in `html` and
the block's metadata in `block`, so it can place the HTML in
the right location and optionally inspect the block's
properties for layout decisions.

Nested blocks with `visibleWhen` evaluating to `false` are
removed entirely - they won't appear in the rendered output.
