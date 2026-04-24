---
title: Add another
section: patterns
path: patterns/add-another
teaches: [CollectionBlock, Iterator.Map, Item, submit, onSubmission, onAccess, query-param-removal, query-param-edit, validWhen-step, LoadItemForEdit, EditItemInCollection]
prerequisites: [journey, step, Answer, submit, effects, validation]
---

<p class="govuk-caption-xl">Patterns</p>

# Add another
A list page that lets users build a collection one item at a time.
Each item is collected on a separate form page, then displayed as a
summary card with change and remove links. The user can edit existing
items, keep adding, or continue when the list is complete.

<p class="govuk-body"><a class="govuk-button" href="/forge-developer-guide/patterns/demos/add-another" data-module="govuk-button">Try the live demo</a></p>

{{slot:toc}}

---

## When to use it

Reach for this pattern when users need to provide a variable number of
the same kind of thing: emergency contacts, previous addresses, trips,
qualifications, or any repeating group of fields.

It fits well when:

- The number of items is not known up front.
- Each item has enough fields that collecting them inline on a single
  page would be cluttered.
- Users benefit from seeing the full list before continuing, with the
  ability to remove mistakes.

If each item is a single value (for example a list of email addresses),
a simpler repeating text input on one page may be more appropriate. If
the number of items is fixed and small, separate steps or a fieldset
per item can be cleaner.

---

## What the pattern covers

- A list page that renders the collection using `CollectionBlock` and
  `Iterator.Map`, with a fallback message for empty collections.
- Summary cards for each item, each with change and remove links.
- An "Add another" button that loops back to the form without
  validation.
- A "Continue" button that moves forward to check your answers.
- An add page that validates and appends a new item to the collection.
- An edit page that pre-fills from an existing item and replaces it on
  submission.
- Removal via a query parameter handled in an `onAccess` hook.
- Step-level validation that requires at least one item before
  continuing.

---

## Anatomy of the flow

```
/forge-developer-guide/patterns/demos/add-another/
├── /overview                 → Landing page (demo aid)
├── /your-contacts            → List page: cards, add-another, continue
├── /add-contact              → Form: name, relationship, phone (appends)
├── /edit-contact/:index      → Form: pre-filled from item at index (replaces)
├── /check-answers            → Summary of all contacts
└── /confirmation             → Submission panel
```

The list page, add page, and edit page form a loop. Each time the user
submits the add form, the new item is appended to the collection. Each
time they submit the edit form, the existing item is replaced. Both
redirect back to the list page, where they can add another, edit or
remove an item, or continue.

---

## How it works

### The collection answer

All items live in a single answer array. The demo stores emergency
contacts under the code `contacts`, where each element is an object
with the fields collected on the add page:

```typescript
// After two items have been added, Answer('contacts') resolves to:
[
  { contactName: 'Jo Smith', contactRelationship: 'partner', contactPhone: '07700 900000' },
  { contactName: 'Alex Jones', contactRelationship: 'friend', contactPhone: '07700 900001' },
]
```

Individual field answers (`contactName`, `contactRelationship`,
`contactPhone`) are temporary. They exist only while the user is
filling in the add page, then an effect bundles them into an object
and appends it to the array.

---

### Rendering the list with CollectionBlock

`CollectionBlock` walks an array of blocks and renders each one. Pair
it with `Answer().each(Iterator.Map(...))` to transform each item in
the collection into a summary card:

```typescript
import { Answer, Item, Iterator, Format } from '@ministryofjustice/hmpps-forge/core/authoring'
import { CollectionBlock } from '@ministryofjustice/hmpps-forge/core/components'
import { GovUKSummaryList, GovUKInsetText } from '@ministryofjustice/hmpps-forge/govuk-components'

const contactCards = CollectionBlock({
  collection: Answer('contacts').each(
    Iterator.Map(
      GovUKSummaryList({
        card: {
          title: { text: Item().path('contactName') },
          actions: {
            items: [
              {
                href: Format('edit-contact/%1', Item().index()),
                text: 'Change',
                visuallyHiddenText: Item().path('contactName'),
              },
              {
                href: Format('your-contacts?remove=%1', Item().index()),
                text: 'Remove',
                visuallyHiddenText: Item().path('contactName'),
              },
            ],
          },
        },
        rows: [
          {
            key: { text: 'Relationship' },
            value: { text: Item().path('contactRelationship') },
          },
          {
            key: { text: 'Phone number' },
            value: { text: Item().path('contactPhone') },
          },
        ],
      }),
    ),
  ),
  fallback: [GovUKInsetText({ text: 'You have not added any emergency contacts yet.' })],
})
```

Inside the iterator, `Item()` references the current element.
`Item().path('contactName')` reads the `contactName` property.
`Item().index()` gives the zero-based position, used here to build
the change and removal links.

The `fallback` array renders when the collection is empty or
undefined, so the page always has meaningful content.

---

### The add-another and continue buttons

The list page needs two submit paths: one that loops back to the add
form, and one that moves forward. Use a `GovUKButtonGroup` with named
buttons whose `value` distinguishes the intent:

```typescript
GovUKButtonGroup({
  buttons: [
    GovUKButton({
      text: 'Add another contact',
      classes: 'govuk-button--secondary',
      name: 'action',
      value: 'add-another',
    }),
    GovUKButton({
      text: 'Continue',
      name: 'action',
      value: 'continue',
    }),
  ],
})
```

The step's `onSubmission` hooks match on the posted action value to
decide where to redirect:

```typescript
onSubmission: [
  submit({
    when: Post('action').match(Condition.Equals('add-another')),
    validate: false,
    onAlways: {
      next: [redirect({ goto: 'add-contact' })],
    },
  }),
  submit({
    when: Post('action').match(Condition.Equals('continue')),
    validate: true,
    onValid: {
      next: [redirect({ goto: 'check-answers' })],
    },
  }),
]
```

The "add another" path skips validation so the user is never blocked
from adding their first contact when the collection is empty. The
"continue" path validates, which triggers the step-level `validWhen`
rule and shows an error if no contacts have been added.

---

### Adding an item

The add page collects fields for a single item. On valid submission,
an effect bundles the temporary field answers into an object and
appends it to the collection array:

```typescript
submit({
  validate: true,
  onValid: {
    effects: [
      PatternEffects.AddItemToCollection('contacts', CONTACT_FIELD_CODES),
      PatternEffects.SaveDraftAnswers('add-another'),
    ],
    next: [redirect({ goto: 'your-contacts' })],
  },
})
```

`AddItemToCollection` reads each field code from the form context,
builds an object from them, pushes it onto the `contacts` array, and
clears the temporary fields so they do not appear pre-filled when the
user adds the next item.

The redirect sends the user back to the list page, where the new item
appears as a card.

---

### Removing an item

Each summary card includes a remove link whose `href` points back to
the list page with a `?remove=` query parameter carrying the item's
index:

```typescript
href: Format('your-contacts?remove=%1', Item().index())
```

The list step's `onAccess` hook watches for that parameter. After
removing the item and saving, the hook redirects back to the clean
URL so the query parameter does not persist on refresh:

```typescript
onAccess: [
  access({
    when: Query('remove').match(Condition.IsRequired()),
    effects: [
      PatternEffects.RemoveItemFromCollection('contacts'),
      PatternEffects.SaveDraftAnswers('add-another'),
    ],
    next: [redirect({ goto: 'your-contacts' })],
  }),
]
```

The redirect strips the `?remove=` parameter from the URL. Without
it, refreshing the page would re-trigger the removal.

---

### Editing an item

Each summary card includes a change link whose `href` points to the
edit page with the item's index as a path parameter:

```typescript
href: Format('edit-contact/%1', Item().index())
```

The edit step declares `:index` in its path, so Forge extracts the
index from the URL automatically:

```typescript
step({
  code: 'edit-contact',
  path: '/edit-contact/:index',
  ...
})
```

The step's `onAccess` hook pre-fills the form fields from the
existing item:

```typescript
onAccess: [
  access({
    effects: [PatternEffects.LoadItemForEdit('add-another', 'contacts', CONTACT_FIELD_CODES)],
  }),
]
```

`LoadItemForEdit` does three things:

1. Reads the `:index` route parameter to get the item position.
2. Copies each field from `contacts[index]` into the form context, so
   the inputs render pre-filled.
3. Stores the edit index in the session so the submission handler knows
   which item to replace.

On valid submission, `EditItemInCollection` replaces the item at the
stored index instead of appending:

```typescript
onSubmission: [
  submit({
    validate: true,
    onValid: {
      effects: [
        PatternEffects.EditItemInCollection('add-another', 'contacts', CONTACT_FIELD_CODES),
        PatternEffects.SaveDraftAnswers('add-another'),
      ],
      next: [redirect({ goto: 'your-contacts' })],
    },
  }),
]
```

`EditItemInCollection` bundles the current field answers into an
object, replaces the item at the stored index, clears the temporary
fields, and removes the stored index from the session. The redirect
sends the user back to the list page where the updated card appears.

---

### Saving state before redirecting

When the user clicks "Add another", the step saves draft answers
before redirecting. A non-validating submit hook handles this:

```typescript
onSubmission: [
  submit({
    when: Post('action').match(Condition.Equals('add-another')),
    validate: false,
    onAlways: {
      effects: [PatternEffects.SaveDraftAnswers('add-another')],
      next: [redirect({ goto: 'add-contact' })],
    },
  }),
]
```

`onAlways` runs before any redirect outcome, so the collection state
is persisted to the session before the redirect clears the form
context.

---

### Requiring at least one item

The list page has no fields of its own, so field-level validation does
not apply. Instead, a step-level `validWhen` rule checks that the
collection is not empty before the user can continue:

```typescript
step({
  code: 'your-contacts',
  path: '/your-contacts',
  validWhen: [
    validation({
      condition: Answer('contacts').match(Condition.IsRequired()),
      message: 'Add at least one emergency contact',
    }),
  ],
  onSubmission: [
    submit({
      when: Post('action').match(Condition.Equals('add-another')),
      validate: false,
      onAlways: {
        next: [redirect({ goto: 'add-contact' })],
      },
    }),
    submit({
      when: Post('action').match(Condition.Equals('continue')),
      validate: true,
      onValid: {
        next: [redirect({ goto: 'check-answers' })],
      },
    }),
  ],
})
```

`Condition.IsRequired()` returns false for `undefined`, `null`, empty
strings, and empty arrays, so it catches both the case where no items
have been added and where all items have been removed.

The "add another" submission keeps `validate: false` so the user is
never blocked from adding their first contact. Only the "continue"
submission sets `validate: true`, which triggers the step-level rule
and shows an error in the error summary if the collection is empty.

### Step validation and reachability

Step-level `validWhen` has a dual role: it gates submission **and**
feeds into the reachability graph. When the rule fails, Forge treats
the step as invalid and will not propagate past it to downstream
steps. This is useful here because it prevents the user from skipping
directly to check-answers with an empty list.

However, it also means the add page would be unreachable if it only
appeared after the list page in the forward graph. The fix is to mark
the add page as an entry point:

```typescript
step({
  code: 'add-contact',
  path: '/add-contact',
  reachability: { entryWhen: true },
  ...
})
```

An entry point is always independently reachable regardless of whether
earlier steps are valid. This gives us both properties:

- The list page blocks forward propagation to check-answers when
  empty (the `validWhen` rule fails).
- The add page remains reachable because it is an entry point, so the
  "add another" redirect always works.

In the demo, `entryWhen: true` is fine because nothing precedes the
list page. In a real journey where earlier steps collect required
information first, make the entry conditional on state that proves
those steps are complete:

```typescript
step({
  code: 'add-contact',
  path: '/add-contact',
  reachability: {
    entryWhen: Answer('previousStepField').match(Condition.IsRequired()),
  },
  ...
})
```

This prevents users from URL-hopping into the add page before they
have legitimately reached that part of the journey.

---

## Variations

- **Inline "add another".** For items with only one or two fields,
  you can render the fields directly on the list page instead of
  redirecting to a separate add step. The form submits to itself,
  and the `onSubmission` hook appends the new item and re-renders.
- **Shared add/edit step.** The demo uses separate add and edit
  steps for clarity. When the fields are identical, you can combine
  them into a single step that checks whether an edit index is
  present and switches between appending and replacing accordingly.
- **Minimum and maximum counts.** Use `Answer('contacts')` with
  `Transformer.Array.Length()` to gate the continue button or show
  a validation message. For example, requiring at least one contact
  before allowing the user to proceed.
- **Reorder items.** Add move-up and move-down links to each card
  that swap adjacent items in the array via a submit hook and
  effect.
