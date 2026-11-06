---
title: Defining blocks and fields
section: building-journeys
path: building-journeys/defining-blocks-and-fields
teaches: [block, field, variant, visibleWhen, BlockDefinition, FieldBlockDefinition, blocks-array, component-registry, code, defaultValue, validWhen, formatters, parsers, dependentWhen, multiple]
prerequisites: [step, StepDefinition]
---

<p class="govuk-caption-xl">Building flows and content</p>

# Defining blocks and fields

Blocks and fields are the building blocks of every page in Forge.
Blocks display content; fields capture user input. Both are
declarative definitions that describe *what* should appear on the
page, not *how* it should be rendered.

{{slot:toc}}

---

## What is a block?
Every page in Forge is built from blocks. A block is a declarative definition
that describes *what* should appear on the page.

A block is a plain object with a `variant` string that tells Forge which
registered component should render it. The block carries the data; the component
decides what to do with it.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};

block(obj! {
    "variant": "html",
    "content": "<p class=\"govuk-body\">Hello world</p>",
})
```

This separation is the key design principle: **block definitions are decoupled
from rendering.** The same block definition could be rendered by a Nunjucks
template, a React component, or a plain function that returns an HTML string.
Forge does not care which - it just matches the `variant` to whatever
component is registered for it.

---

## Blocks vs fields

There are two kinds of block, created by two builder functions:

| Builder    | Creates              | Purpose                        |
|------------|----------------------|--------------------------------|
| `block()`  | `BlockDefinition`    | Display content (read-only)    |
| `field()`  | `FieldBlockDefinition` | Collect user input           |

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};

// A block - displays content, no data capture
block(obj! {
    "variant": "html",
    "content": "<h1 class=\"govuk-heading-l\">Your details</h1>",
})
// A field - captures input, has a code for storing the answer
field(obj! {
    "variant": "govukTextInput",
    "code": "full_name",
    "label": "Full name",
})
```

A field is a block with extra capabilities: it has a `code` that identifies the
answer, and it supports `validWhen`, `defaultValue`, `formatters`, `parsers`,
`dependentWhen`, and `multiple`. Everything else (variant resolution, visibility,
metadata) works the same way for both.

---

## The `blocks` array

Every step has a `blocks` array. The order in the array is the order on the page.
Blocks and fields are interleaved freely:

```rust
step(obj! {
    "path": "/contact",
    "title": "Contact details",
    "blocks": [
        block(obj! { "variant": "html", "content": "<h1>Contact details</h1>" }),
        field(obj! { "variant": "govukTextInput", "code": "email", "label": "Email address" }),
        block(obj! {
            "variant": "html",
            "content": "<p>We will only use this to send confirmation.</p>",
        }),
        field(obj! { "variant": "govukTextInput", "code": "phone", "label": "Phone number" }),
        block(obj! { "variant": "govukButton", "text": "Continue" }),
    ],
})
```

```
Step
├── block  (heading)
├── field  (email input)
├── block  (help text)
├── field  (phone input)
└── block  (submit button)
```

---

## How variant resolution works

When Forge renders a step, it processes each block in the `blocks` array:

1. **Evaluate** - All expressions in the block definition are resolved.
   `answer()`, `data()`, `format()`, `when().then().otherwise()` etc. become
   concrete values.
2. **Look up** - Forge finds the component registered for the block's `variant`
   string.
3. **Render** - The component's render function receives the evaluated block
   and returns HTML.

```
block(obj! { "variant": "html", "content": format("Hello, %1", [answer("name").into()]) })
                           │                  │
                           │           ┌──────┘
                           │           ▼
                           │    1. Evaluate: content becomes "Hello, Alice"
                           │
                           ▼
                  2. Look up: find the component registered for 'html'
                           │
                           ▼
                  3. Render: component returns "<p>Hello, Alice</p>"
```

This means a block definition is just data. It contains no rendering logic,
template paths, or framework dependencies. The component registry is what connects
variants to renderers, and that registry is configured when you set up Forge - not
when you author a form.

---

## Block properties

### `variant` (Required)

The string that maps this block to a registered component. This is how Forge
knows what to render.

```rust
"variant": "html",
// Core: raw HTML renderer
"variant": "templateWrapper",
// Core: slot-based layout composition
"variant": "collection-block",
// Core: iterate and render a collection
"variant": "govukTextInput",
// GOV.UK: text input component
"variant": "myCustomCard",
// Your own: whatever you register
```

The variant is just a string key. Forge ships a few built-in components, but any
string works as long as a component is registered for it.

### `visibleWhen` (Optional)

Controls whether the block is rendered. Defaults to `true` (always visible).

```rust
block(obj! {
    "variant": "html",
    "content": "<p>You selected the United Kingdom.</p>",
    "visibleWhen": answer("country").matches(condition::equals("UK")),
})
```

When `visibleWhen` evaluates to `false`, the block is skipped entirely - no HTML
is emitted. This works for both blocks and fields.

> **Note:** For fields, `visibleWhen` only controls rendering. The field still
> participates in validation. To also skip validation and clear the value when
> hidden, use `dependentWhen`.

### `metadata` (Optional)

Arbitrary data attached to the block. Forge does not use it internally.
It is there for your application to use however it needs.

```rust
block(obj! {
    "variant": "html",
    "content": "...",
    "metadata": obj! { "section": "intro", "analyticsId": "welcome-text" },
})
```

---

## Field properties

Fields extend blocks with properties for data capture. Everything
from the block properties section above (`variant`, `visibleWhen`,
`metadata`) applies to fields too.

### `code` (Required)

A unique identifier for the field's answer. This is the key used to
store and retrieve the value. Reference it elsewhere with
`answer("code")`.

```rust
field(obj! {
    "variant": "govukTextInput",
    "code": "email",
    "label": "Email address",
})
```

### `defaultValue` (Optional)

The initial value for the field. Can be a static value or an
expression like `answer()` or `data()`.

```rust
"defaultValue": data("user.email"),
```

### `formatters` (Optional)

Transformers applied to the submitted value before validation runs.
Use these for normalisation like trimming whitespace or converting
case.

```rust
"formatters": [transformer::string::trim(), transformer::string::to_lower_case()],
```

### `parsers` (Optional)

Transformers applied to a stored value when loading it back into the
field for display. Parsers are the inverse of formatters: they convert
the canonical stored form back to what the component needs to render.
Most fields do not need parsers. They are only required when a
formatter changes data into a shape the component cannot render, such
as collapsing a multi-part date into an ISO string.

```rust
"parsers": [transformer::object::from_iso(obj! { "year": "year", "month": "month", "day": "day" })],
```

Parsers do not modify the stored answer. Conditions and other
references to the answer always see the canonical form. See
[Transformers](../authoring-language/transformers) for details.

### `validWhen` (Optional)

An array of validation rules for this field. Each rule has a condition
that must be `true` for the field to be valid, and a message shown
when it fails. See [Validation](validation) for full details.

```rust
"validWhen": [
    validation(obj! {
        "condition": self_().matches(condition::is_required()),
        "message": "Enter your email address",
    }),
    validation(obj! {
        "condition": self_().matches(condition::email::is_valid_email()),
        "message": "Enter a valid email address",
    }),
],
```

### `dependentWhen` (Optional)

Controls whether the field participates in validation and retains its
value. When the expression evaluates to `false`, the field is skipped
during validation and its stored answer is cleared.

This is different from `visibleWhen`, which only controls rendering.
Use `dependentWhen` when a field should be completely inactive based
on another answer.

```rust
field(obj! {
    "variant": "govukTextareaInput",
    "code": "otherDetails",
    "label": "Give details",
    // When `reason` is not `'other'`, this field is hidden, its validation
    // is skipped, and any previously entered value is cleared.
    "dependentWhen": answer("reason").matches(condition::equals("other")),
    "validWhen": [
        validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Enter details",
        }),
    ],
})
```

### `multiple` (Optional)

When `true`, the field captures all submitted values as an array
rather than a single value. Components with a fixed value shape
declare this on their registry entry instead — `govukCheckboxInput`
always captures an array, so you never set it per field:

```rust
field(obj! {
    "variant": "govukCheckboxInput",
    "code": "contactMethods",
    "items": [
        obj! { "value": "email", "text": "Email" },
        obj! { "value": "phone", "text": "Phone" },
        obj! { "value": "post", "text": "Post" },
    ],
})
```

Reach for the field-level flag only with components that can be
either single- or multi-value, where the choice is genuinely yours.

---

## Wrapper functions

In practice, you rarely call `block()` or `field()` directly. Component packages
provide wrappers (constants such as `govuk::TEXT_INPUT`) whose `.build()` calls
the builder for you and sets the `variant` automatically:

```rust
// This:
block(obj! { "variant": "html", "content": "<h1>Hello</h1>" })

// Is what this does under the hood:
core_blocks::HTML.build(obj! { "content": "<h1>Hello</h1>" })
```

These wrappers exist purely for convenience - they don't add
behaviour. Whether you use `core_blocks::HTML` or `block(obj! { "variant": "html" })`,
Forge sees the same definition.

The important thing is that wrapper functions are owned by component packages,
not by Forge itself. A GOV.UK component package provides `govuk::TEXT_INPUT`.
An MOJ component package provides `moj::CARD_GROUP`. Your application can provide
its own. They all produce block definitions with a `variant` string - Forge
treats them identically.

You can also build your own wrapper functions for patterns you use often.
A wrapper can wrap an existing wrapper to inject a standard set of
validation rules, simplify the interface, or return multiple blocks at
once for a common group of fields such as an address.

---

## The component registry

For a `variant` to work, a component must be registered for it. This happens
once when you configure Forge, not in your form definitions:

```rust
let mut forge = Forge::new(ForgeOptions::default());
forge.register_global_components(forge_govuk_components::components())?;
forge.register_global_components(forge_moj_components::components())?;
forge.register_global_components([my_custom_card()])?;
```

A component is just a variant string paired with a render function:

```rust
use forge_core::ComponentEntry;

fn my_custom_card() -> ComponentEntry {
    ComponentEntry::new("myCustomCard").with_render(|block, _| {
        Ok(Value::from(format!(
            r#"
    <div class="app-card">
      <h2>{}</h2>
      <p>{}</p>
    </div>
  "#,
            block.get("title").to_js_string(),
            block.get("description").to_js_string(),
        )))
    })
}
```

If a block references a variant that isn't registered, Forge will return an error
during startup validation - before any routes are mounted. This surfaces missing
components at startup, not when a user happens to visit the page.

See the [Components](../building-functions-and-components/custom-components) section for full details on building
and registering components.

---

## Dynamic properties

Any property on a block (not just `content` or `visibleWhen`) can be a dynamic
expression. Forge evaluates all expressions in the block before passing it to
the component's render function:

```rust
field(obj! {
    "variant": "govukRadioInput",
    "code": "country",
    "fieldset": obj! { "legend": obj! { "text": "Select your country" } },
    "items": data("countries"), // Loaded by an effect, resolved at render time
})
```

The component receives the evaluated block - it sees a plain array of items,
not a `data()` expression. This means components don't need to know about
Forge's expression system. They just receive concrete values.

---

## Best practices

- **Think in terms of variant + data, not HTML.** A block says "render a
  `govukTextInput` with this label" - not "render an `<input>` tag with these
  classes". The component handles the how.
- **Use `dependentWhen` alongside `visibleWhen` for conditional fields.**
  `visibleWhen` hides the field; `dependentWhen` also skips validation and
  clears the value.
- **Split steps and blocks into their own files.** If you find yourself with a
  particularly large page, it can be a good idea to move the blocks into their own file.
- **Extract reusable patterns into variables.** If you find yourself
  repeating the same group of blocks across pages, store them in a
  variable and destructure them into each step's `blocks` array.
