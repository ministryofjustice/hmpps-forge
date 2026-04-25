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
  `Format()` and `Loop.Index0()`.
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

`CollectionBlock` iterates over a `Data()` array. Inside
`Iterator.Map`, each form field gets a unique code built from
the field name and the item's index:

```typescript
CollectionBlock({
  collection: Data('members').each(
    Iterator.Map(
      GovUKGridRow({
        columns: [
          {
            width: 'one-third',
            blocks: [
              GovUKTextInput({
                code: Format('memberName_%1', Loop.Index0()),
                label: { text: 'Name' },
                defaultValue: Item().path('memberName'),
              }),
            ],
          },
          // ... more columns
        ],
      }),
    ),
  ),
  fallback: [],
})
```

When the collection has two items, Forge materialises fields
with codes `memberName_0` and `memberName_1`. The engine
resolves these dynamically at render time and matches them to
POST data on submission.

### Initialising the collection on access

An access hook loads the collection from the session and sets
both the `Data()` array (for the iterator) and individual
field answers (for the form inputs):

```typescript
onAccess: [
  access({
    effects: [
      PatternEffects.InitializeRepeatingFieldsets(
        patternCode, collectionCode, fieldCodes,
      ),
    ],
  }),
],
```

The effect ensures at least one empty item exists so the page
always renders with at least one row of fields.

### Adding an item

The "Add another" button posts with `action=add-another`. An
non-validating submit hook catches it and runs the effect. Because
the hook has no redirect, the page re-renders with the updated
collection:

```typescript
onSubmission: [
  submit({
    when: Post('action').match(Condition.Equals('add-another')),
    validate: false,
    onAlways: {
      effects: [
        PatternEffects.AddRepeatingItem(
          patternCode, collectionCode, fieldCodes,
        ),
      ],
    },
  }),
],
```

The effect reads every current field value from the POST data
into the session collection, appends a new empty item, then
updates `Data()` and answers. The page re-renders with the new
row immediately.

### Removing an item

Each row has a "Remove" button whose value encodes the item's
index:

```typescript
GovUKButton({
  text: 'Remove',
  name: 'action',
  value: Format('remove_%1', Loop.Index0()),
  classes: 'govuk-button--warning',
})
```

A second submit hook matches any value starting with `remove_`:

```typescript
submit({
  when: Post('action').match(Condition.String.StartsWith('remove_')),
  validate: false,
  onAlways: {
    effects: [
      PatternEffects.RemoveRepeatingItem(
        patternCode, collectionCode, fieldCodes,
      ),
    ],
  },
}),
```

The effect parses the index from the POST action value, saves
current field values, splices the item, and re-indexes the
remaining answers. If only one item remains, it clears the
values instead of removing the row.

### Submitting the collection

The "Continue" button validates all fields and saves the final
state:

```typescript
onSubmission: [
  submit({
    when: Post('action').match(Condition.Equals('continue')),
    validate: true,
    onValid: {
      effects: [
        PatternEffects.SaveRepeatingItems(
          patternCode, collectionCode, fieldCodes,
        ),
      ],
      next: [redirect({ goto: 'check-answers' })],
    },
  }),
],
```

Validation runs across all dynamically-created fields. If any
name or age is missing, the error summary shows which field
failed.

---

## Variations

- **Reordering.** Add up and down buttons per row. A submit hook
  swaps adjacent items in the array and re-indexes answers.
- **Minimum or maximum items.** Use `validWhen` on the step to
  enforce a minimum count, and disable "Add another" when the
  maximum is reached using a `visibleWhen` condition.
- **Mixed field types.** Replace text inputs with selects, radios,
  or date fields. The pattern works with any field component as
  long as the `code` uses `Format()` with `Loop.Index0()`.
- **Nested collections.** Each item could itself contain a
  sub-collection, using nested `Iterator.Map` with
  `Item().parent` to access the outer scope.
