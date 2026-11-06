---
title: Custom components
section: building-functions-and-components
path: building-functions-and-components/custom-components
teaches: [Component, ComponentEntry, nunjucks_render, evaluated-block, rendered-block, custom-component-variant, field-value, field-errors]
prerequisites: [block, field, ForgePackage]
---

<p class="govuk-caption-xl">Components</p>

# Building custom components

Blocks are the declarative objects you author in a journey. Components
are the renderers that turn those blocks into HTML. Forge ships with
components for the GOV.UK and MOJ design systems, plus a small core set
(`core_blocks::HTML`, `core_blocks::COLLECTION_BLOCK`, `core_blocks::TEMPLATE_WRAPPER`). When your service
needs a visual that the built-in set does not cover, you can define
your own component and register it alongside your journey.

{{slot:toc}}

---

## Blocks and components

A block definition is data. A component is the function that renders
that data. The two are linked by a `variant` string: the block sets
`"variant": "myCard"` and the component registers itself with the same
variant, so Forge knows which renderer to call.

```
block:       { "variant": "myCard", "heading": "Title", ... }
                                      |
                             variant lookup
                                      v
component:   render(block) -> "<div class=\"my-card\">...</div>"
```

By the time a component is called, every expression in the block has
already been resolved. `answer("name")` has become the string the
user typed. `visibleWhen` has been evaluated (and the block would
have been filtered out if it returned false). Nested blocks have
been pre-rendered to HTML. The component only sees concrete values.

---

## The block wrapper

Every custom component starts with a block wrapper: a `Component`
constant that journey definitions build blocks with. Its doc comment
is the public API that journey definitions use, so list the props
there.

Use `Component::basic` for a display component, or `Component::field`
for one that captures user input:

```rust
use forge_core::authoring::Component;

/// A card with a heading and optional body text.
///
/// Props (each accepts a value or an expression):
/// - `heading` - the card's heading.
/// - `content` - body text shown below the heading (optional).
/// - `outlined` - whether to show a subtle border (optional).
pub const MY_CARD: Component = Component::basic("myCard");
```

Props are not typed: every prop accepts a plain value, an `answer()`
or `data()` reference, a `format()` expression, a pipeline, or any
other expression, and Forge resolves it before your renderer runs.
Say in the doc comment which props should stay static (an inline
`attributes` map, for example).

---

## The block definition

The wrapper fixes the `variant`, so authors do not have to set it
themselves.

For a display block:

```rust
// MY_CARD.build(props) sets the variant and builds the block:
MY_CARD.build(obj! { "heading": "Title" })
// is the same as
block(obj! { "heading": "Title", "variant": "myCard" })
```

For a field block, use `Component::field`, which builds with `field`
instead of `block`. Field blocks gain a `code`, validation, and the
runtime `value`/`errors` state described below.

```rust
/// A star rating field.
///
/// Props: `code`, `label`, `maxStars`, plus the usual field props
/// (`validWhen`, `defaultValue`, ...).
pub const MY_STAR_RATING: Component = Component::field("myStarRating");
```

---

## The renderer

A component's renderer is a function that receives the evaluated
block and returns an HTML string, registered with
`ComponentEntry::new(variant).with_render(...)`. There are two
common shapes, depending on how you want to produce HTML.

### Pure function components

A plain closure is the simpler of the two. The render function
takes the evaluated block and returns HTML. Use this when the output
is short, self-contained, and does not need a template engine.

```rust
use forge_core::{ComponentEntry, Value};

pub fn my_card() -> ComponentEntry {
    ComponentEntry::new("myCard").with_render(|block, _engine| {
        let border = if block.get("outlined").truthy() { " my-card--outlined" } else { "" };
        let content = match block.get("content") {
            Value::Undefined | Value::Null => String::new(),
            content => format!(r#"<p class="govuk-body">{}</p>"#, content.to_js_string()),
        };

        Ok(Value::from(format!(
            r#"
    <div class="my-card{border}">
      <h2 class="govuk-heading-m">{}</h2>
      {content}
    </div>
  "#,
            block.get("heading").to_js_string(),
        )))
    })
}
```

The `variant` string passed to `ComponentEntry::new` must match the
`variant` set on the block. That is how Forge finds the right
renderer at runtime.

### Template-based components

`nunjucks_render` (from `forge_runjucks`) is the right choice when
you want to render through a Nunjucks template. It takes the
template path and a function that builds the template's `params`
from the evaluated block, and renders with the Runjucks engine the
renderer passes to every component.

```rust
use forge_core::{ComponentEntry, Value, obj};
use forge_runjucks::nunjucks_render;

fn my_card_params(block: &Value) -> Value {
    obj! {
        "heading": block.get("heading"),
        "content": block.get("content"),
        "outlined": block.get("outlined"),
    }
}

pub fn my_card() -> ComponentEntry {
    ComponentEntry::new("myCard").with_render(nunjucks_render("components/my-card/template.njk", my_card_params))
}
```

The built-in GOV.UK and MOJ components follow this pattern. Each one
extracts a `params` object from the evaluated block, then hands that
to the matching design-system template. Your own Nunjucks components
should do the same: keep the renderer thin, and let the template
deal with markup.

---

## What the evaluated block contains

The block passed to your renderer is the evaluated block, a `Value`.
The important points:

- **All props are resolved values.** If the definition passed
  `answer("name")`, `block.get("heading")` is now a plain string.
  There is no expression object to evaluate.
- **Props omitted in the definition are `Value::Undefined`.** Guard
  before reading them, especially for optional content.
- **Field blocks gain `value` and `errors`.** `block.get("value")` is
  the current answer, resolved from submission, `defaultValue`, or a
  loaded answer store. `block.get("errors")` is an array of
  `{ message, details? }` populated when validation has run and
  failed. Both can be undefined.
- **Nested block props arrive as rendered blocks.** If your props
  accept an array of blocks (for slots or children), Forge has
  already rendered them before your component runs. Each entry is
  `{ block, html }`. Concatenate the `html` values to place them in
  your output. Your renderer never calls the rendering pipeline
  itself.

```rust
fn render_children(children: &Value) -> String {
    children
        .as_array()
        .map(|children| children.iter().map(|child| child.get("html").to_js_string()).collect())
        .unwrap_or_default()
}
```

---

## Field blocks: value and errors

Field components use `value` and `errors` to drive their output. A
cut-down GOV.UK text input is a compact example:

```rust
fn text_input_params(block: &Value) -> Value {
    let errors = block.get("errors");
    obj! {
        "id": match block.get("id") {
            Value::Undefined | Value::Null => block.get("code"),
            id => id,
        },
        "name": block.get("code"),
        "label": match block.get("label") {
            label @ Value::Object(_) => label,
            label => obj! { "text": label },
        },
        "value": block.get("value"),
        "errorMessage": match errors.as_array() {
            Some(errors) if !errors.is_empty() => obj! { "text": errors[0].get("message") },
            _ => Value::Undefined,
        },
    }
}

pub fn govuk_text_input() -> ComponentEntry {
    ComponentEntry::new("govukTextInput").with_render(nunjucks_render("govuk/components/input/template.njk", text_input_params))
}
```

A few things to copy from this pattern:

- **Use the block's `code` for the `name` attribute.** The code is the
  field's identity in the answer store. A POST with
  `name="email"` is what flows back into `answer("email")`.
- **Default the `id` to the code.** Authors can override it for
  legitimate cases (for example, two fields sharing a name), but the
  common case is `id == code`.
- **Render the first error.** `errors` is ordered. Most
  design systems only display one message at a time.

---

## Composite fields: multiple inputs, one value

A field block does not have to map to a single HTML input. A date
input renders three boxes for day, month and year but stores one
answer. A price input might render a currency dropdown alongside a
number box. A quantity input might pair a value with a unit selector.
The pattern that makes this work is the same in every case, and it
uses standard HTTP form behaviour rather than a Forge-specific
mechanism.

### The submission path

Emit each sub-input with a bracketed `name` attribute built from the
field's `code`:

```rust
<input name="{code}[day]"   value="{day}" />
<input name="{code}[month]" value="{month}" />
<input name="{code}[year]"  value="{year}" />
```

When the form is submitted, the Topcoat adapter's body parser expands
the bracket notation into a nested object. All three inputs arrive under
the field's single `code` as
`{ "day": "31", "month": "3", "year": "1980" }`. From Forge's point of view,
this is one answer whose value happens to be an object.

A formatter then reshapes the object into the canonical form that the
rest of the definition will see. The built-in date inputs pair with
`transformer::object::to_iso` to collapse the three parts into an ISO
date string before validation runs:

```rust
govuk::DATE_INPUT_FULL.build(obj! {
    "code": "dateOfBirth",
    "label": obj! { "text": "Date of birth" },
    "formatters": [
        transformer::object::to_iso(obj! { "year": "year", "month": "month", "day": "day" }),
    ],
})
```

By the time `validWhen` evaluates `self_()`, the stored answer is the
string `"1980-03-31"`. Other pages see that same ISO string through
`answer("dateOfBirth")`. The three-input structure is invisible
outside the component.

### The render path

On render, the block's `value` is already in the shape the component
expects. The field's `parsers` convert the stored ISO string back to
an object with date parts before the component sees it. On POST
(validation failure re-render), `value` is the raw submitted object.
Either way, the component receives an object:

```rust
let parts = block.get("value");
let code = block.get("code").to_js_string();

let items = [
    obj! { "name": format!("{code}[day]"),   "value": parts.get("day") },
    obj! { "name": format!("{code}[month]"), "value": parts.get("month") },
    obj! { "name": format!("{code}[year]"),  "value": parts.get("year") },
];
```

The built-in `govuk::DATE_INPUT_FULL` wrapper adds both a formatter
(`transformer::object::to_iso`) and a parser (`transformer::object::from_iso`)
automatically, through `Component::with_prepare`. If you are building a
custom multi-part component, add the appropriate formatter and parser
in your wrapper's `with_prepare` so authors do not need to specify them
manually.

### Per-part error styling

When a composite field fails validation, it is often useful to
highlight only the specific input that caused the failure. Validation
rules pass this hint through `details`:

```rust
validation(obj! {
    "condition": not(and(vec![self_().matches(condition::object::is_object()), self_().not().matches(condition::object::property_has_value("day"))])),
    "message": "Date must include a day",
    "details": obj! { "field": "day" },
})
```

Forge does not interpret `details`. It forwards the object verbatim to
the component through the first error's `details`. The component
decides what to do with it. The GOV.UK date input uses it to apply an
error class to one input while leaving the others alone, and falls
back to highlighting all inputs when `details.field` is absent:

```rust
let errors = block.get("errors");
let error_details = errors.get("0").get("details");
let has_error = errors.as_array().is_some_and(|e| !e.is_empty());

let class_for_field = |field_name: &str| -> Option<&str> {
    if !has_error {
        return None;
    }
    match error_details.get("field").as_str() {
        None => Some("govuk-input--error"),
        Some(field) if field == field_name => Some("govuk-input--error"),
        Some(_) => None,
    }
};
```

### When to reach for this pattern

Composite fields make sense when several inputs represent parts of a
single conceptual value. Date parts, address parts, price with
currency, quantity with unit. The test is whether the answer makes
sense as a single `answer()` reference elsewhere in the definition.
If each part needs to be read, validated and displayed independently,
they are better modelled as separate fields.

---

## Escaping and XSS

Nunjucks autoescapes variables by default, so template-based
components inherit sensible output handling. Pure-function
components are on the hook themselves: any value you interpolate
into HTML could have come from user input or external data, and
must be escaped before it reaches the markup.

Define a small escaping helper alongside your component, or use
`forge_core::builtins::components::escape_html_entities`. Authors can
also apply `transformer::string::escape_html()` in the definition.

```rust
fn escape_html(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

pub fn my_badge() -> ComponentEntry {
    ComponentEntry::new("myBadge").with_render(|block, _engine| {
        let label = match block.get("label") {
            Value::Undefined | Value::Null => String::new(),
            label => escape_html(&label.to_js_string()),
        };

        Ok(Value::from(format!(r#"<span class="my-badge">{label}</span>"#)))
    })
}
```

Attributes need the same treatment. When building a class or data
attribute from a dynamic prop, escape both the key and the value.

---

## Registration

Components are registered on the package with `with_components()`:

```rust
use forge_core::ForgePackage;
use crate::components::{my_badge, my_card};

pub fn my_package() -> ForgePackage {
    ForgePackage::new(my_journey()).with_components([my_card(), my_badge()])
}
```

Components registered through a package are scoped to that journey.
To make a component available to every journey in the application,
use `forge.register_global_components()` instead. This is how the
GOV.UK and MOJ component packages expose their built-ins.

---

## Using custom components

Once registered, a custom component is used like any built-in:

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

govuk::INSET_TEXT.build(obj! { "text": "Welcome back." })
MY_CARD.build(obj! {
    "heading": format("Hello, %1", [answer("firstName").into()]),
    "content": data("user.bio"),
    "outlined": true,
})
```

Because props are resolved before rendering, authors can pass
expressions for any prop. Forge resolves them before
calling the renderer.

---

## Testing

Renderers are plain functions. Call them with a hand-crafted
evaluated block and assert on the returned HTML. Pure-function
components need no framework setup (pass `&()` as the engine):

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use forge_core::obj;

    #[test]
    fn my_card_should_include_the_heading_text() {
        // Arrange
        let block = obj! {
            "variant": "myCard",
            "heading": "Hello",
            "content": "Body text",
            "outlined": false,
        };

        // Act
        let render = my_card().render.unwrap();
        let html = render(&block, &()).unwrap().to_js_string();

        // Assert
        assert!(html.contains("Hello"));
        assert!(html.contains("Body text"));
    }
}
```

For a `nunjucks_render` renderer, test the params function directly
and leave the template to Runjucks:

```rust
#[test]
fn should_pass_heading_to_the_template() {
    // Arrange
    let block = obj! {
        "variant": "myCard",
        "heading": "Hello",
    };

    // Act
    let params = my_card_params(&block);

    // Assert
    assert_eq!(params.get("heading"), Value::from("Hello"));
}
```

For field components, include `value` and `errors` in the test
block to exercise populated and error states separately.

---

## Best practices

- **Document the props on the wrapper.** Props are untyped, so the
  wrapper's doc comment is the only place authors learn what a
  component accepts.
- **Keep renderers thin.** A renderer pulls values off the
  evaluated block and hands them to a template or a short HTML
  string. Move logic that belongs in the authoring layer
  (conditions, formatting) into the definition instead.
- **Escape all dynamic values in pure-function components.** Nunjucks
  templates autoescape; raw strings do not. Escape both attribute
  values and text interpolated into markup.
- **Default `id` to `code` on field components.** The code is the
  canonical identity. Authors can override the id for edge cases
  but should not need to in the common case.
- **Render nested blocks by concatenating their `html`.** Blocks
  passed as props arrive pre-rendered as `{ block, html }` objects.
  Your component never runs the pipeline itself.
- **For composite fields, pair the renderer with a formatter.** Use
  bracketed input names so the body parser combines the parts into a
  single object, then collapse the object into a canonical form with
  a formatter like `transformer::object::to_iso` before validation runs.
- **Scope components through the package by default.** Register
  globally only when a component is genuinely shared across every
  journey in the application.
