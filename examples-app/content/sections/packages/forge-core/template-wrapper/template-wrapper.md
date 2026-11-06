---
title: TemplateWrapper
section: packages
path: packages/forge-core/template-wrapper
teaches: [core_blocks::TEMPLATE_WRAPPER, template, slot, values]
prerequisites: [block, forge-core]
---

<p class="govuk-caption-xl">Forge Core</p>

# TemplateWrapper
TemplateWrapper lets you wrap child blocks in an HTML template. It
bridges the gap between Forge's component model and the custom
layouts your service needs, without writing a full custom component.

{{slot:toc}}

---

## What it does

Every Forge block maps to a single component variant. That works
well for standard inputs and content, but sometimes you need to
arrange several blocks inside a layout that does not exist as a
component: a card, a grid row, a details disclosure, or a section
with a heading above its children.

TemplateWrapper solves this by accepting an HTML template string with
named **slot markers** and **value markers**. At render time, Forge
replaces each marker with the rendered output of the child blocks or
string values you provide.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;
use forge_core::builtins::components as core_blocks;

core_blocks::TEMPLATE_WRAPPER.build(obj! {
    "template": "\n    <div class=\"app-card\">\n      <h2 class=\"govuk-heading-m\">{{title}}</h2>\n      {{slot:body}}\n      {{slot:actions}}\n    </div>\n  ",
    "values": obj! {
        "title": "Card heading",
    },
    "slots": obj! {
        "body": [govuk::BODY.build(obj! { "text": "Some content inside the card." })],
        "actions": [govuk::BUTTON.build(obj! { "text": "Continue" })],
    },
})
```

The template is plain HTML. The component does not parse or validate
it. It performs string replacement on the markers, concatenates the
rendered HTML of each slot's blocks, and returns the result.

---

## How it works

1. **Value replacement** - the component scans the template for
   `{{name}}` markers and replaces each one with the corresponding
   entry from the `values` object. Values are injected as-is; they
   are not HTML-escaped by default.
2. **Slot replacement** - the component scans for `{{slot:name}}`
   markers. For each one, it renders the blocks listed under that
   slot name, concatenates their HTML, and replaces the marker.
3. **Cleanup** - any markers that were not matched by a value or slot
   are removed silently. This means optional slots and values do not
   leave raw marker text in the output.
4. **Wrapper element** - if you provide `tag`, `classes`, or
   `attributes`, the component wraps the entire output in an element.
   The `tag` property sets the element type (defaults to `<div>`).
   If none of these are set, the template output is returned
   unwrapped.

Markers can appear more than once in a template. Each occurrence is
replaced with the same content.

---

## API surface

### template (Required)

An HTML string containing slot markers (`{{slot:name}}`) and value
markers (`{{name}}`).

```rust
core_blocks::TEMPLATE_WRAPPER.build(obj! {
    "template": "<section class=\"app-section\">{{slot:content}}</section>",
    "slots": obj! {
        "content": [govuk::BODY.build(obj! { "text": "Section content." })],
    },
})
```

The `template` property accepts a `ResolvableString`, so it can vary
based on conditions using `when().then().otherwise()`.

### values (Optional)

An object mapping value marker names to string values. Each key
corresponds to a `{{key}}` marker in the template.

```rust
core_blocks::TEMPLATE_WRAPPER.build(obj! {
    "template": "<h2 class=\"govuk-heading-m\">{{heading}}</h2><p class=\"govuk-body\">{{description}}</p>",
    "values": obj! {
        "heading": "Application details",
        "description": "Review the information below.",
    },
})
```

Values accept `ResolvableString`, so they can be dynamic. Because
values are injected directly into HTML, escape any untrusted data
with `transformer::string::escape_html()`.

### slots (Optional)

An object mapping slot marker names to arrays of block definitions.
Each key corresponds to a `{{slot:name}}` marker in the template.

```rust
core_blocks::TEMPLATE_WRAPPER.build(obj! {
    "template": "<div class=\"govuk-grid-row\"><div class=\"govuk-grid-column-two-thirds\">{{slot:main}}</div><div class=\"govuk-grid-column-one-third\">{{slot:sidebar}}</div></div>",
    "slots": obj! {
        "main": [govuk::BODY.build(obj! { "text": "Main content." })],
        "sidebar": [govuk::BODY.build(obj! { "text": "Sidebar content." })],
    },
})
```

Blocks inside a slot are rendered in order and their HTML is
concatenated.

### tag (Optional)

HTML element type for the wrapper. When set, `classes` and
`attributes` are applied to this element. Defaults to `div` when
omitted but `classes` or `attributes` are present.

```rust
core_blocks::TEMPLATE_WRAPPER.build(obj! {
    "template": "{{slot:content}}",
    "tag": "section",
    "classes": "app-section",
    "slots": obj! {
        "content": [govuk::BODY.build(obj! { "text": "Inside a section element." })],
    },
})
// Renders: <section class="app-section">...</section>
```

Setting `tag` alone (without `classes` or `attributes`) still
triggers the wrapper element.

### classes (Optional)

CSS classes applied to the wrapper element. When set without `tag`,
the element defaults to `<div>`.

```rust
core_blocks::TEMPLATE_WRAPPER.build(obj! {
    "template": "<p>Content</p>",
    "classes": "govuk-!-margin-bottom-6",
})
// Renders: <div class="govuk-!-margin-bottom-6"><p>Content</p></div>
```

### attributes (Optional)

HTML attributes for the wrapper element. Like `classes`, this
triggers a wrapper when no `tag` is set (defaulting to `<div>`).

```rust
core_blocks::TEMPLATE_WRAPPER.build(obj! {
    "template": "<p>Content</p>",
    "attributes": obj! { "data-module": "app-section", "id": "details" },
})
// Renders: <div data-module="app-section" id="details"><p>Content</p></div>
```

### visibleWhen (Optional)

A predicate that controls whether the entire template wrapper is
rendered. Works the same as `visibleWhen` on any other block.

---

## Practical examples

### Two-column layout

```rust
core_blocks::TEMPLATE_WRAPPER.build(obj! {
    "template": "\n    <div class=\"govuk-grid-row\">\n      <div class=\"govuk-grid-column-two-thirds\">{{slot:main}}</div>\n      <div class=\"govuk-grid-column-one-third\">{{slot:aside}}</div>\n    </div>\n  ",
    "slots": obj! {
        "main": [name_field, email_field, continue_button],
        "aside": [govuk::BODY.build(obj! { "text": "Need help? Contact support." })],
    },
})
```

### Card with dynamic heading

```rust
core_blocks::TEMPLATE_WRAPPER.build(obj! {
    "template": "\n    <div class=\"app-card\">\n      <h2 class=\"govuk-heading-m\">{{heading}}</h2>\n      {{slot:content}}\n    </div>\n  ",
    "values": obj! {
        "heading": answer("fullName"),
    },
    "slots": obj! {
        "content": [govuk::SUMMARY_LIST.build(obj! { "rows": summary_rows })],
    },
})
```

### Wrapping a group of buttons

The GOV.UK Design System groups buttons inside a
`govuk-button-group` div. TemplateWrapper can do this without a
dedicated component:

```rust
core_blocks::TEMPLATE_WRAPPER.build(obj! {
    "template": "<div class=\"govuk-button-group\">{{slot:buttons}}</div>",
    "slots": obj! {
        "buttons": [
            govuk::BUTTON.build(obj! { "text": "Save and continue" }),
            govuk::BUTTON.build(obj! { "text": "Cancel", "classes": "govuk-button--secondary" }),
        ],
    },
})
```

### Building reusable wrappers

Because TemplateWrapper returns a standard block definition, you can
wrap it in a function to create reusable layout components without
registering a custom component:

```rust
use forge_core::builtins::components as core_blocks;
use forge_core::{Value, obj};

fn app_card(heading: &str, blocks: Vec<Value>) -> Value {
    core_blocks::TEMPLATE_WRAPPER.build(obj! {
        "template": r#"<div class="app-card"><h2 class="govuk-heading-m">{{heading}}</h2>{{slot:content}}</div>"#,
        "values": obj! { "heading": heading },
        "slots": obj! { "content": blocks },
    })
}
```

This gives you reusable layout without the overhead of a full custom
component registration.

---

## Best practices

- Use TemplateWrapper for layout and structure. If you need
  conditional rendering logic, event handling, or complex state, a
  custom component is a better fit.
- Keep templates short. A template that spans more than 10 to 15
  lines is a sign that you should extract it into a custom component
  or break it into nested TemplateWrappers.
- Escape user-facing values. Values from `answer()` or `data()` that
  contain user input should be piped through
  `transformer::string::escape_html()` to prevent XSS.
- Prefer slots over values for block content. Values are for short
  strings like headings and labels. Slots are for composed block
  output.
