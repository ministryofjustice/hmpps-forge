---
title: CollectionBlock
section: packages
path: packages/forge-core/collection-block
teaches: [core_blocks::COLLECTION_BLOCK, collection, fallback]
prerequisites: [block, forge-core, item-and-iterators]
---

<p class="govuk-caption-xl">Forge Core</p>

# CollectionBlock
CollectionBlock renders a list of blocks from a dynamic collection.
It is how you turn an array of data into repeated UI - cards, rows,
list items, or any other component - without writing loops by hand.

{{slot:toc}}

---

## What it does

Most pages display data that varies at runtime: search results, saved
contacts, task lists, table rows. CollectionBlock takes an expression
that evaluates to an array of blocks and renders each one in
sequence. When the array is empty, it renders an optional fallback
instead.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;
use forge_core::builtins::components as core_blocks;

core_blocks::COLLECTION_BLOCK.build(obj! {
    "collection": data("messages").each(iterator::map(govuk::BODY.build(obj! { "text": item().path("text") }))),
    "fallback": [govuk::INSET_TEXT.build(obj! { "text": "No messages to display." })],
})
```

The `collection` property accepts any chainable expression that
resolves to an array of blocks. In practice this almost always means
a `data()` or `answer()` reference chained with `.each()` and an
`iterator::map` that produces a block for each item.

---

## How it works

1. **Evaluation** - at render time, the component evaluates the
   `collection` expression. The result is an array of rendered
   blocks.
2. **Rendering** - if the array has items, the component
   concatenates the HTML of each rendered block in order and returns
   the combined output.
3. **Fallback** - if the array is empty (or the expression evaluates
   to nothing), the component renders the `fallback` blocks instead.
   If no fallback is provided, the content is empty - though an empty
   wrapper element still renders if `tag`, `classes`, or `attributes`
   are set.
4. **Wrapper element** - if you provide `tag`, `classes`, or
   `attributes`, the component wraps the output in an element. The
   `tag` property sets the element type (defaults to `<div>`). If
   none of these are set, the concatenated HTML is returned
   unwrapped.

---

## API surface

### collection (Required)

An expression that evaluates to an array of blocks. This is
typically a `data()` or `answer()` reference chained with `.each()`
and `iterator::map`.

```rust
core_blocks::COLLECTION_BLOCK.build(obj! {
    "collection": data("stations").each(iterator::map(govuk::BODY.build(obj! { "text": item().path("name") }))),
})
```

The template inside `iterator::map` is evaluated once per item in the
source array. Use `item()` to reference properties of the current
item and `Loop` for iteration metadata like the index.

### fallback (Optional)

An array of block definitions to render when the collection is
empty. This is useful for showing a message when there are no
results, or when data has not been loaded yet.

```rust
core_blocks::COLLECTION_BLOCK.build(obj! {
    "collection": data("results").each(iterator::map(govuk::BODY.build(obj! { "text": item().path("title") }))),
    "fallback": [govuk::INSET_TEXT.build(obj! { "text": "No results found." })],
})
```

### tag (Optional)

HTML element type for the wrapper. When set, `classes` and
`attributes` are applied to this element. Defaults to `div` when
omitted but `classes` or `attributes` are present.

```rust
core_blocks::COLLECTION_BLOCK.build(obj! {
    "collection": data("items").each(iterator::map(core_blocks::HTML.build(obj! { "tag": "li", "content": item().path("name") }))),
    "tag": "ul",
    "classes": "govuk-list",
})
// Renders: <ul class="govuk-list"><li>...</li><li>...</li></ul>
```

### classes (Optional)

CSS classes applied to the wrapper element. When set without `tag`,
the element defaults to `<div>`.

```rust
core_blocks::COLLECTION_BLOCK.build(obj! {
    "collection": data("cards").each(iterator::map(my_card)),
    "classes": "govuk-!-margin-bottom-6",
})
```

### attributes (Optional)

HTML attributes for the wrapper element. Like `classes`, this
triggers a wrapper when no `tag` is set (defaulting to `<div>`).

```rust
core_blocks::COLLECTION_BLOCK.build(obj! {
    "collection": data("items").each(iterator::map(my_item)),
    "attributes": obj! { "data-module": "item-list" },
})
```

### visibleWhen (Optional)

A predicate that controls whether the entire collection block is
rendered. Works the same as `visibleWhen` on any other block.

---

## Practical examples

### List of summary cards

A common pattern for "add another" flows: each item in a collection
renders as a summary card with change and remove links.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;
use forge_core::builtins::components as core_blocks;

core_blocks::COLLECTION_BLOCK.build(obj! {
    "collection": answer("contacts").each(iterator::map(govuk::SUMMARY_LIST.build(obj! {
        "card": obj! {
            "title": obj! { "text": item().path("contactName") },
            "actions": obj! {
                "items": [
                    obj! {
                        "href": format("edit-contact/%1", [Loop.index0().into()]),
                        "text": "Change",
                        "visuallyHiddenText": item().path("contactName"),
                    },
                    obj! {
                        "href": format("delete-contact/%1", [Loop.index0().into()]),
                        "text": "Remove",
                        "visuallyHiddenText": item().path("contactName"),
                    },
                ],
            },
        },
        "rows": [
            obj! {
                "key": obj! { "text": "Phone" },
                "value": obj! { "text": item().path("contactPhone") },
            },
        ],
    }))),
    "fallback": [govuk::INSET_TEXT.build(obj! { "text": "You have not added any contacts yet." })],
})
```

### Search results

Render a list of results from a search query, with a fallback
message when nothing matches.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;
use forge_core::builtins::components as core_blocks;

core_blocks::COLLECTION_BLOCK.build(obj! {
    "collection": data("searchResults").each(iterator::map(core_blocks::HTML.build(obj! {
        "tag": "div",
        "classes": "govuk-!-margin-bottom-6",
        "content": [
            govuk::HEADING.build(obj! { "text": item().path("name"), "size": "s" }),
            govuk::BODY.build(obj! {
                "text": format("Lines: %1", [item().path("lines").into()]),
                "size": "s",
            }),
            core_blocks::HTML.build(obj! {
                "tag": "a",
                "classes": "govuk-link",
                "attributes": obj! { "href": item().path("href") },
                "content": "View details",
            }),
        ],
    }))),
    "fallback": [
        govuk::INSET_TEXT.build(obj! {
            "text": "No matching results found.",
            "visibleWhen": data("hasSearched").matches(condition::is_required()),
        }),
    ],
})
```

### Paginated list with a wrapper element

Wrap the rendered items in a semantic element using `tag`.

```rust
core_blocks::COLLECTION_BLOCK.build(obj! {
    "collection": data("stations").each(iterator::map(core_blocks::HTML.build(obj! {
        "tag": "li",
        "content": item().path("name"),
    }))),
    "tag": "ul",
    "classes": "govuk-list govuk-list--bullet",
})
```

---

## Best practices

- Always provide a `fallback` when the collection might be empty.
  An empty page with no explanation is confusing.
- Keep the `iterator::map` template focused on a single block or a
  small composition. If the template grows complex, extract it into
  a named variable or a helper function.
- Use `tag` to produce semantic HTML. A list of items should be a
  `<ul>` or `<ol>`, not a series of `<div>` elements.
- Combine with `visibleWhen` to hide the entire collection
  conditionally, rather than relying on the fallback for
  show/hide logic.
