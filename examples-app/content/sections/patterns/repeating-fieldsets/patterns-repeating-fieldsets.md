---
title: Repeating fieldsets
section: patterns
path: patterns/repeating-fieldsets
teaches: [repeating-fieldsets, iterator-fields, dynamic-field-codes, onSubmission]
prerequisites: [step, effects, answers, data, iterator]
---

<p class="govuk-caption-xl">Patterns</p>

# Repeating fieldsets
A single page that collects a variable number of items through
repeating groups of form fields. Each "Add another" press appends
a new row of empty inputs. All items are editable at the same
time and submitted together.

<p class="govuk-body"><a class="govuk-button" href="/forge-developer-guide/patterns/demos/repeating-fieldsets" data-module="govuk-button">Try the live demo</a></p>

{{slot:toc}}

---

## When to use it

Reach for this pattern when users need to provide a variable
number of the same kind of thing and each item is simple enough
to fit on a single row.

It fits well when:

- Each item has only a few fields (one to three).
- Users benefit from seeing all items at once so they can compare
  or edit them side by side.
- The total number of items is typically small (under ten).

If each item has many fields or complex validation, the
[add another](add-another) pattern with a dedicated page per item
is usually cleaner. If the number of items is fixed and known up
front, separate fieldsets on one page may be simpler.

---

## What the pattern covers

The live demo collects household members, each with a name and
age. Following the flow shows:

- **Form inputs inside an iterator** that create dynamic field
  codes like `memberName_0`, `memberName_1` using
  `format()` and `Loop.index0()`.
- **An "Add another" submit hook** that appends an empty item to
  the collection and re-renders the page with a new row.
- **A "Remove" submit hook** that splices an item from the
  collection and re-indexes the remaining fields.
- **Session-backed state** that preserves in-progress edits
  across submissions and page reloads.

---

## Anatomy of the flow

```
/forge-developer-guide/patterns/demos/repeating-fieldsets/
├── /overview             → Overview and "See the demo" button
├── /household-members    → Repeating fieldsets with add/remove
├── /check-answers        → Summary cards for each member
└── /confirmation         → Submission panel
```

The household-members step does all the work. The collection lives
in the session. Non-validating submit hooks mutate it and the page
re-renders with the updated rows.

---

## How it works

### Dynamic field codes in an iterator

`core_blocks::COLLECTION_BLOCK` iterates over a `data()` array. Inside
`iterator::map`, each form field gets a unique code built from
the field name and the item's index:

```rust
core_blocks::COLLECTION_BLOCK.build(obj! {
    "collection": data("members").each(iterator::map([
        govuk::TEXT_INPUT.build(obj! {
            "code": format("memberName_%1", [Loop.index0().into()]),
            "label": obj! { "text": "Name" },
            "defaultValue": item().path("memberName"),
        }),
        // ... age field, Remove button, section break
    ])),
    "fallback": [govuk::INSET_TEXT.build(obj! { "text": "You have not added any household members yet." })],
})
```

When the collection has two items, Forge materialises fields
with codes `memberName_0` and `memberName_1`. The engine
resolves these dynamically at render time and matches them to
POST data on submission.

### Initialising the collection on access

An access hook loads the collection from the session and sets
both the `data()` array (for the iterator) and individual
field answers (for the form inputs):

```rust
"onAccess": [
    access(obj! {
        "effects": [
            effect::call("InitializeRepeatingFieldsets", vec![pattern_code.into(), collection_code.into(), field_codes.into()]),
        ],
    }),
],
```

If the session has no stored items yet, the effect does nothing
and the `core_blocks::COLLECTION_BLOCK` renders its `fallback` - an inset text
saying no members have been added.

### Adding an item

The "Add another" button posts with `action=add-another`. A
non-validating submit hook catches it and runs the effect. Because
the hook has no redirect, the page re-renders with the updated
collection:

```rust
"onSubmission": [
    submit(obj! {
        "when": post("action").matches(condition::equals("add-another")),
        "validate": false,
        "onAlways": obj! {
            "effects": [
                effect::call("AddRepeatingItem", vec![pattern_code.into(), collection_code.into(), field_codes.into()]),
            ],
        },
    }),
],
```

The effect reads every current field value from the POST data
into the session collection, appends a new empty item, then
updates `data()` and answers. The page re-renders with the new
row immediately.

### Removing an item

Each row has a "Remove" button whose value encodes the item's
index:

```rust
govuk::BUTTON.build(obj! {
    "text": "Remove",
    "name": "action",
    "value": format("remove_%1", [Loop.index0().into()]),
    "classes": "govuk-button--warning",
})
```

A second submit hook matches any value starting with `remove_`:

```rust
submit(obj! {
    "when": post("action").matches(condition::string::starts_with("remove_")),
    "validate": false,
    "onAlways": obj! {
        "effects": [
            effect::call("RemoveRepeatingItem", vec![pattern_code.into(), collection_code.into(), field_codes.into()]),
        ],
    },
})
```

The effect parses the index from the POST action value, saves
current field values, splices the item, and re-indexes the
remaining answers. Removing the last item leaves an empty
collection, so the `fallback` renders instead.

### Submitting the collection

The "Continue" button validates all fields and saves the final
state:

```rust
"onSubmission": [
    submit(obj! {
        "when": post("action").matches(condition::equals("continue")),
        "validate": true,
        "onValid": obj! {
            "effects": [
                effect::call("SaveRepeatingItems", vec![pattern_code.into(), collection_code.into(), field_codes.into()]),
            ],
            "next": [redirect(obj! { "goto": "check-answers" })],
        },
    }),
],
```

Validation runs across all dynamically-created fields. If any
name or age is missing, the error summary shows which field
failed. The step also has a step-level `validWhen` rule that
requires at least one member before the user can continue.

---

## Variations

- **Reordering.** Add up and down buttons per row. A submit hook
  swaps adjacent items in the array and re-indexes answers.
- **Maximum items.** The demo already enforces a minimum of one
  member with a step-level `validWhen`. To cap the count, hide the
  "Add another" button with a `visibleWhen` condition once the
  maximum is reached.
- **Mixed field types.** Replace text inputs with selects, radios,
  or date fields. The pattern works with any field component as
  long as the `code` uses `format()` with `Loop.index0()`.
- **Nested collections.** Each item could itself contain a
  sub-collection, using nested `iterator::map` with
  `item().parent()` to access the outer scope.
