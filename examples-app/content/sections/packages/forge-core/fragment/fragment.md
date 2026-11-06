---
title: Fragment
section: packages
path: packages/forge-core/fragment
teaches: [core_blocks::FRAGMENT, fragment]
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
several. The most common case is the template of an `iterator::map()`,
which yields one block per item. Fragment lets that one block contain
as many as you need, with nothing extra in the output HTML.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;
use forge_core::builtins::components as core_blocks;

core_blocks::COLLECTION_BLOCK.build(obj! {
    "collection": data("tasks").each(iterator::map(core_blocks::FRAGMENT.build(obj! {
        "blocks": [
            govuk::HEADING.build(obj! { "text": item().path("title"), "size": "s" }),
            govuk::BODY.build(obj! { "text": item().path("description") }),
        ],
    }))),
})
```

Each task renders a heading followed by a paragraph - no wrapper
`<div>` around the pair.

If you *do* want a wrapper element around the group, use
`core_blocks::HTML` with a `tag` instead. Fragment is specifically for when
you don't.

---

## API surface

### blocks (Required)

The child blocks to render, in order.

```rust
core_blocks::FRAGMENT.build(obj! {
    "blocks": [
        govuk::HEADING.build(obj! { "text": "Your details", "size": "m" }),
        govuk::BODY.build(obj! { "text": "Check the information below before continuing." }),
    ],
})
```

### visibleWhen (Optional)

A predicate that controls whether the fragment (and everything in it)
is rendered. Works the same as `visibleWhen` on any other block, which
makes Fragment a handy way to show or hide a group of blocks with a
single condition.

```rust
core_blocks::FRAGMENT.build(obj! {
    "blocks": [
        govuk::HEADING.build(obj! { "text": "Previous convictions", "size": "m" }),
        govuk::BODY.build(obj! { "text": "List each conviction separately." }),
    ],
    "visibleWhen": answer("hasConvictions").matches(condition::equals("yes")),
})
```
