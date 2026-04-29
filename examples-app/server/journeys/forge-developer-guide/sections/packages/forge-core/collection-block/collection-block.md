---
title: CollectionBlock
section: packages
path: packages/forge-core/collection-block
teaches: [CollectionBlock, collection, fallback]
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

```typescript
import { Data, Item, Iterator } from '@ministryofjustice/hmpps-forge/core/authoring'
import { CollectionBlock } from '@ministryofjustice/hmpps-forge/core/components'
import { GovUKBody, GovUKInsetText } from '@ministryofjustice/hmpps-forge/govuk-components'

CollectionBlock({
  collection: Data('messages').each(
    Iterator.Map(
      GovUKBody({ text: Item().path('text') }),
    ),
  ),
  fallback: [GovUKInsetText({ text: 'No messages to display.' })],
})
```

The `collection` property accepts any chainable expression that
resolves to an array of blocks. In practice this almost always means
a `Data()` or `Answer()` reference chained with `.each()` and an
`Iterator.Map` that produces a block for each item.

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
   If no fallback is provided, nothing is rendered.
4. **Wrapper element** - if you provide `tag`, `classes`, or
   `attributes`, the component wraps the output in an element. The
   `tag` property sets the element type (defaults to `<div>`). If
   none of these are set, the concatenated HTML is returned
   unwrapped.

---

## API surface

### collection (Required)

An expression that evaluates to an array of blocks. This is
typically a `Data()` or `Answer()` reference chained with `.each()`
and `Iterator.Map`.

```typescript
CollectionBlock({
  collection: Data('stations').each(
    Iterator.Map(
      GovUKBody({ text: Item().path('name') }),
    ),
  ),
})
```

The template inside `Iterator.Map` is evaluated once per item in the
source array. Use `Item()` to reference properties of the current
item and `Loop` for iteration metadata like the index.

### fallback (Optional)

An array of block definitions to render when the collection is
empty. This is useful for showing a message when there are no
results, or when data has not been loaded yet.

```typescript
CollectionBlock({
  collection: Data('results').each(
    Iterator.Map(
      GovUKBody({ text: Item().path('title') }),
    ),
  ),
  fallback: [GovUKInsetText({ text: 'No results found.' })],
})
```

### tag (Optional)

HTML element type for the wrapper. When set, `classes` and
`attributes` are applied to this element. Defaults to `div` when
omitted but `classes` or `attributes` are present.

```typescript
CollectionBlock({
  collection: Data('items').each(
    Iterator.Map(
      HtmlBlock({ tag: 'li', content: Item().path('name') }),
    ),
  ),
  tag: 'ul',
  classes: 'govuk-list',
})
// Renders: <ul class="govuk-list"><li>...</li><li>...</li></ul>
```

### classes (Optional)

CSS classes applied to the wrapper element. When set without `tag`,
the element defaults to `<div>`.

```typescript
CollectionBlock({
  collection: Data('cards').each(Iterator.Map(myCard)),
  classes: 'govuk-!-margin-bottom-6',
})
```

### attributes (Optional)

HTML attributes for the wrapper element. Like `classes`, this
triggers a wrapper when no `tag` is set (defaulting to `<div>`).

```typescript
CollectionBlock({
  collection: Data('items').each(Iterator.Map(myItem)),
  attributes: { 'data-module': 'item-list' },
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

```typescript
import { Answer, Item, Iterator, Loop, Format } from '@ministryofjustice/hmpps-forge/core/authoring'
import { CollectionBlock } from '@ministryofjustice/hmpps-forge/core/components'
import { GovUKSummaryList, GovUKInsetText } from '@ministryofjustice/hmpps-forge/govuk-components'

CollectionBlock({
  collection: Answer('contacts').each(
    Iterator.Map(
      GovUKSummaryList({
        card: {
          title: { text: Item().path('contactName') },
          actions: {
            items: [
              {
                href: Format('edit-contact/%1', Loop.Index0()),
                text: 'Change',
                visuallyHiddenText: Item().path('contactName'),
              },
              {
                href: Format('delete-contact/%1', Loop.Index0()),
                text: 'Remove',
                visuallyHiddenText: Item().path('contactName'),
              },
            ],
          },
        },
        rows: [
          {
            key: { text: 'Phone' },
            value: { text: Item().path('contactPhone') },
          },
        ],
      }),
    ),
  ),
  fallback: [GovUKInsetText({ text: 'You have not added any contacts yet.' })],
})
```

### Search results

Render a list of results from a search query, with a fallback
message when nothing matches.

```typescript
import { Data, Item, Iterator, Format, Condition } from '@ministryofjustice/hmpps-forge/core/authoring'
import { CollectionBlock, HtmlBlock } from '@ministryofjustice/hmpps-forge/core/components'
import { GovUKHeading, GovUKBody, GovUKInsetText } from '@ministryofjustice/hmpps-forge/govuk-components'

CollectionBlock({
  collection: Data('searchResults').each(
    Iterator.Map(
      HtmlBlock({
        tag: 'div',
        classes: 'govuk-!-margin-bottom-6',
        content: [
          GovUKHeading({ text: Item().path('name'), size: 's' }),
          GovUKBody({
            text: Format('Lines: %1', Item().path('lines')),
            size: 's',
          }),
          HtmlBlock({
            tag: 'a',
            classes: 'govuk-link',
            attributes: { href: Item().path('href') },
            content: 'View details',
          }),
        ],
      }),
    ),
  ),
  fallback: [
    GovUKInsetText({
      text: 'No matching results found.',
      visibleWhen: Data('hasSearched').match(Condition.IsRequired()),
    }),
  ],
})
```

### Paginated list with a wrapper element

Wrap the rendered items in a semantic element using `tag`.

```typescript
CollectionBlock({
  collection: Data('stations').each(
    Iterator.Map(
      HtmlBlock({
        tag: 'li',
        content: Item().path('name'),
      }),
    ),
  ),
  tag: 'ul',
  classes: 'govuk-list govuk-list--bullet',
})
```

---

## Best practices

- Always provide a `fallback` when the collection might be empty.
  An empty page with no explanation is confusing.
- Keep the `Iterator.Map` template focused on a single block or a
  small composition. If the template grows complex, extract it into
  a named variable or a helper function.
- Use `tag` to produce semantic HTML. A list of items should be a
  `<ul>` or `<ol>`, not a series of `<div>` elements.
- Combine with `visibleWhen` to hide the entire collection
  conditionally, rather than relying on the fallback for
  show/hide logic.
