---
title: Fragment
section: packages
path: packages/forge-core/fragment
teaches: [Fragment, fragment]
prerequisites: [block, forge-core, item-and-iterators]
---

<p class="govuk-caption-xl">Forge Core</p>

# Fragment

Fragment groups child blocks without adding a wrapper element. The
blocks render back-to-back, exactly as they would as siblings.

{{slot:toc}}

---

## What it does

Some places in Forge expect a single block but you want to output
several. The most common case is the template of an `Iterator.Map()`,
which yields one block per item. Fragment lets that one block contain
as many as you need, with nothing extra in the output HTML.

```typescript
import { Data, Item, Iterator } from '@ministryofjustice/hmpps-forge/core/authoring'
import { CollectionBlock, Fragment } from '@ministryofjustice/hmpps-forge/core/components'
import { GovUKHeading, GovUKBody } from '@ministryofjustice/hmpps-forge/govuk-components'

CollectionBlock({
  collection: Data('tasks').each(
    Iterator.Map(
      Fragment({
        blocks: [
          GovUKHeading({ text: Item().path('title'), size: 's' }),
          GovUKBody({ text: Item().path('description') }),
        ],
      }),
    ),
  ),
})
```

Each task renders a heading followed by a paragraph - no wrapper
`<div>` around the pair.

If you *do* want a wrapper element around the group, use
`HtmlBlock` with a `tag` instead. Fragment is specifically for when
you don't.

---

## API surface

### blocks (Required)

The child blocks to render, in order.

```typescript
Fragment({
  blocks: [
    GovUKHeading({ text: 'Your details', size: 'm' }),
    GovUKBody({ text: 'Check the information below before continuing.' }),
  ],
})
```

### visibleWhen (Optional)

A predicate that controls whether the fragment (and everything in it)
is rendered. Works the same as `visibleWhen` on any other block, which
makes Fragment a handy way to show or hide a group of blocks with a
single condition.

```typescript
Fragment({
  blocks: [
    GovUKHeading({ text: 'Previous convictions', size: 'm' }),
    GovUKBody({ text: 'List each conviction separately.' }),
  ],
  visibleWhen: Answer('hasConvictions').match(Condition.Equals('yes')),
})
```
