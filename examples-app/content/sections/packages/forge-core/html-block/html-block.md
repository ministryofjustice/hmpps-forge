---
title: HtmlBlock
section: packages
path: packages/forge-core/html-block
teaches: [core_blocks::HTML, tag, void-elements]
prerequisites: [block, forge-core]
---

<p class="govuk-caption-xl">Forge Core</p>

# HtmlBlock
HtmlBlock renders raw HTML content. It is the escape hatch for
markup that does not map to a design system component - custom
elements, separators, links, inline wrappers, or any HTML you
need to drop into a step.

{{slot:toc}}

---

## What it does

Design system components cover most of what a page needs, but
sometimes you need a plain HTML element: a horizontal rule, an
anchor tag, an article wrapper, or a block of static markup. HtmlBlock
lets you render any HTML string or compose child blocks inside a
chosen element.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_core::builtins::components as core_blocks;

core_blocks::HTML.build(obj! {
    "content": "<p class=\"govuk-body\">Terms and conditions apply.</p>",
})
```

Content is rendered as-is with no sanitisation. This makes HtmlBlock
flexible but means you must escape any untrusted data yourself.

---

## How it works

1. **No tag, no classes, no attributes** - the component returns the
   `content` string (or concatenated child block HTML) directly with
   no wrapping element.
2. **Tag or classes or attributes** - the component wraps the content
   in the specified element. The `tag` property sets the element type
   (defaults to `<div>` when only `classes` or `attributes` are
   present).
3. **Void elements** - when `tag` is a void element (`hr`, `br`,
   `img`, etc.), the component renders a self-closing tag and ignores
   `content`.
4. **Child blocks** - `content` can be an array of block definitions
   instead of a string. The component renders each child and
   concatenates their HTML.

---

## API surface

### content (Optional)

The HTML to render. Accepts a string, a dynamic expression, or an
array of child block definitions.

```rust
// Static string
core_blocks::HTML.build(obj! {
    "content": "<p class=\"govuk-body\">Hello world</p>",
})
// Dynamic expression
core_blocks::HTML.build(obj! {
    "content": format("<p class=\"govuk-body\">%1</p>", [data("message").into()]),
})
// Child blocks
core_blocks::HTML.build(obj! {
    "tag": "article",
    "content": [
        govuk::HEADING.build(obj! { "text": "Title", "size": "m" }),
        govuk::BODY.build(obj! { "text": "Body text." }),
    ],
})
```

Content is not sanitised. When interpolating data from user input or
external sources, escape it with `transformer::string::escape_html()`.

### tag (Optional)

HTML element type. When set, `classes` and `attributes` are applied
to this element. Defaults to `div` when omitted but `classes` or
`attributes` are present.

```rust
core_blocks::HTML.build(obj! {
    "tag": "a",
    "classes": "govuk-link",
    "attributes": obj! { "href": "/overview" },
    "content": "Back to overview",
})
// Renders: <a class="govuk-link" href="/overview">Back to overview</a>
```

Void elements (`hr`, `br`, `img`, `input`, etc.) render as
self-closing tags and ignore `content`:

```rust
core_blocks::HTML.build(obj! {
    "tag": "hr",
    "classes": "govuk-section-break govuk-section-break--visible",
})
// Renders: <hr class="govuk-section-break govuk-section-break--visible">
```

### classes (Optional)

CSS classes applied to the element. When set without `tag`, the
element defaults to `<div>`.

```rust
core_blocks::HTML.build(obj! {
    "classes": "govuk-!-margin-bottom-6",
    "content": "<p>Wrapped in a div.</p>",
})
// Renders: <div class="govuk-!-margin-bottom-6"><p>Wrapped in a div.</p></div>
```

### attributes (Optional)

HTML attributes for the element. Like `classes`, this triggers a
wrapper when no `tag` is set (defaulting to `<div>`).

```rust
core_blocks::HTML.build(obj! {
    "tag": "img",
    "attributes": obj! { "src": "/assets/logo.png", "alt": "Service logo" },
})
// Renders: <img src="/assets/logo.png" alt="Service logo">
```

### visibleWhen (Optional)

A predicate that controls whether the block is rendered. Works the
same as `visibleWhen` on any other block.

---

## Practical examples

### Article wrapper with child blocks

Use `tag` and `content` as an array to compose child blocks inside a
semantic element.

```rust
core_blocks::HTML.build(obj! {
    "tag": "article",
    "classes": "govuk-!-margin-bottom-8",
    "content": [
        govuk::HEADING.build(obj! { "text": item().path("title"), "size": "m" }),
        govuk::BODY.build(obj! { "text": item().path("date"), "size": "s" }),
        core_blocks::HTML.build(obj! { "content": item().path("body") }),
        core_blocks::HTML.build(obj! {
            "tag": "hr",
            "classes": "govuk-section-break govuk-section-break--visible govuk-!-margin-top-6",
        }),
    ],
})
```

### Link with dynamic href

Build a styled anchor from dynamic data.

```rust
core_blocks::HTML.build(obj! {
    "tag": "a",
    "classes": "govuk-link govuk-heading-s govuk-!-margin-bottom-1",
    "attributes": obj! { "href": item().path("href") },
    "content": item().path("name"),
})
```

### Safe dynamic content

When content includes values from user input or an external API,
pipe them through `transformer::string::escape_html()` to prevent XSS.

```rust
core_blocks::HTML.build(obj! {
    "content": format("<p class=\"govuk-body\">%1</p>", [data("userComment").pipe([transformer::string::escape_html()]).into()]),
})
```

Without the escape, a value like `<script>alert('xss')</script>`
would be injected directly into the page.

---

## Best practices

- Prefer design system components over HtmlBlock when one exists.
  `govuk::BODY.build(obj! { "text": "..." })` is clearer than
  `core_blocks::HTML.build(obj! { "content": "<p class=\"govuk-body\">...</p>" })`.
- Always escape untrusted data. Any value from `answer()`, `data()`,
  or `item()` that originates from user input or an external source
  must be piped through `transformer::string::escape_html()`.
- Use `tag` instead of writing the element in the content string.
  `core_blocks::HTML.build(obj! { "tag": "a", "content": "Link" })` is easier to read and
  lets you use `classes` and `attributes` cleanly.
- Use child blocks in `content` for composition. Nesting blocks
  inside an HtmlBlock with a `tag` is a lightweight way to group
  related content under a semantic element without needing a
  TemplateWrapper.
