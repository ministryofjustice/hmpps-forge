---
title: Adding, editing and deleting from collections
section: patterns
path: patterns/add-another
teaches: [core_blocks::COLLECTION_BLOCK, iterator::map, item, submit, onSubmission, onAccess, delete-confirmation, validWhen-step, LoadItemForEdit, EditItemInCollection, LoadItemForDelete, DeleteItemFromCollection]
prerequisites: [journey, step, answer, submit, effects, validation]
---

<p class="govuk-caption-xl">Patterns</p>

# Adding, editing and deleting from collections
A list page that lets users build a collection one item at a time.
Each item is collected on a separate form page, then displayed as a
summary card with change and remove links. The user can add items,
edit existing ones, remove items through a confirmation step, or
continue when the list is complete.

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

- A list page that renders the collection using `core_blocks::COLLECTION_BLOCK` and
  `iterator::map`, with a fallback message for empty collections.
- Summary cards for each item, each with change and remove links.
- An "Add another" button that loops back to the form without
  validation.
- A "Continue" button that moves forward to check your answers.
- An add page that validates and appends a new item to the collection.
- An edit page that pre-fills from an existing item and replaces it on
  submission.
- A delete confirmation page that shows the item details and asks the
  user to confirm before removing.
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
├── /delete-contact/:index    → Confirmation: shows item details, confirms removal
├── /check-answers            → Summary of all contacts
└── /confirmation             → Submission panel
```

The list page, add page, edit page, and delete page form a loop. Each
time the user submits the add form, the new item is appended. Each
time they submit the edit form, the existing item is replaced. The
delete page shows the item details and asks for confirmation before
removing. All three redirect back to the list page, where the user
can add another, edit, remove, or continue.

---

## How it works

### The collection answer

All items live in a single answer array. The demo stores emergency
contacts under the code `contacts`, where each element is an object
with the fields collected on the add page:

```rust
// After two items have been added, answer("contacts") resolves to:
[
    obj! {
        "contactName": "Jo Smith",
        "contactRelationship": "partner",
        "contactPhone": "07700 900000",
    },
    obj! {
        "contactName": "Alex Jones",
        "contactRelationship": "friend",
        "contactPhone": "07700 900001",
    },
]
```

Individual field answers (`contactName`, `contactRelationship`,
`contactPhone`) are temporary. They exist only while the user is
filling in the add page, then an effect bundles them into an object
and appends it to the array.

---

### Rendering the list with CollectionBlock

`core_blocks::COLLECTION_BLOCK` walks an array of blocks and renders each one. Pair
it with `answer().each(iterator::map(...))` to transform each item in
the collection into a summary card:

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;
use forge_core::builtins::components as core_blocks;

let contact_cards = core_blocks::COLLECTION_BLOCK.build(obj! {
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
                "key": obj! { "text": "Relationship" },
                "value": obj! { "text": item().path("contactRelationship") },
            },
            obj! {
                "key": obj! { "text": "Phone number" },
                "value": obj! { "text": item().path("contactPhone") },
            },
        ],
    }))),
    "fallback": [govuk::INSET_TEXT.build(obj! { "text": "You have not added any emergency contacts yet." })],
});
```

Inside the iterator, `item()` references the current element.
`item().path("contactName")` reads the `contactName` property.
`Loop.index0()` gives the zero-based position, used here to build
the change and remove links.

The `fallback` array renders when the collection is empty or
undefined, so the page always has meaningful content.

---

### The add-another and continue buttons

The list page needs two submit paths: one that loops back to the add
form, and one that moves forward. Use a `govuk::BUTTON_GROUP` with named
buttons whose `value` distinguishes the intent:

```rust
govuk::BUTTON_GROUP.build(obj! {
    "buttons": [
        govuk::BUTTON.build(obj! {
            "text": "Add another contact",
            "classes": "govuk-button--secondary",
            "name": "action",
            "value": "add-another",
        }),
        govuk::BUTTON.build(obj! {
            "text": "Continue",
            "name": "action",
            "value": "continue",
        }),
    ],
})
```

The step's `onSubmission` hooks match on the posted action value to
decide where to redirect:

```rust
"onSubmission": [
    submit(obj! {
        "when": post("action").matches(condition::equals("add-another")),
        "validate": false,
        "onAlways": obj! {
            "next": [redirect(obj! { "goto": "add-contact" })],
        },
    }),
    submit(obj! {
        "when": post("action").matches(condition::equals("continue")),
        "validate": true,
        "onValid": obj! {
            "next": [redirect(obj! { "goto": "check-answers" })],
        },
    }),
],
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

```rust
submit(obj! {
    "validate": true,
    "onValid": obj! {
        "effects": [
            effect::call("AddItemToCollection", vec!["contacts".into(), CONTACT_FIELD_CODES.into()]),
            effect::call("SaveDraftAnswers", vec!["add-another".into()]),
        ],
        "next": [redirect(obj! { "goto": "your-contacts" })],
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

### Removing an item with confirmation

Each summary card includes a remove link whose `href` navigates to
a dedicated confirmation page, passing the item index as a route
parameter:

```rust
"href": format("delete-contact/%1", [Loop.index0().into()]),
```

The delete step follows the same `:index` route pattern as the edit
step. Its `onAccess` hook loads the item details into `Data` so the
confirmation page can display what is about to be removed:

```rust
step(obj! {
    "code": "delete-contact",
    "path": "/delete-contact/:index",
    "title": "Remove emergency contact",
    "reachability": obj! { "entryWhen": true },
    "onAccess": [
        access(obj! {
            "effects": [effect::call("LoadItemForDelete", vec!["contacts".into(), CONTACT_FIELD_CODES.into()])],
        }),
    ],
    // ...
})
```

`LoadItemForDelete` reads the `:index` route parameter, extracts the
item from the collection, and sets each field as a `Data` value. The
page renders these as a read-only summary so the user can see exactly
which contact they are about to remove.

Two submission hooks handle the user's choice. "Remove contact" uses a
warning button to signal a destructive action. "Cancel" returns the
user to the list page without changes:

```rust
"onSubmission": [
    submit(obj! {
        "when": post("action").matches(condition::equals("confirm")),
        "validate": false,
        "onAlways": obj! {
            "effects": [
                effect::call("DeleteItemFromCollection", vec!["contacts".into()]),
                effect::call("SaveDraftAnswers", vec!["add-another".into()]),
            ],
            "next": [redirect(obj! { "goto": "your-contacts" })],
        },
    }),
    submit(obj! {
        "when": post("action").matches(condition::equals("cancel")),
        "validate": false,
        "onAlways": obj! {
            "next": [redirect(obj! { "goto": "your-contacts" })],
        },
    }),
],
```

`DeleteItemFromCollection` reads the `:index` route parameter and
splices the item from the array. Unlike the edit flow, the delete
step does not need to store the index in the session because the
route parameter is still available during the POST submission.

---

### Editing an item

Each summary card includes a change link whose `href` points to the
edit page with the item's index as a path parameter:

```rust
"href": format("edit-contact/%1", [Loop.index0().into()]),
```

The edit step declares `:index` in its path, so Forge extracts the
index from the URL automatically:

```rust
step(obj! {
    "code": "edit-contact",
    "path": "/edit-contact/:index",
    // ...
})
```

The step's `onAccess` hook pre-fills the form fields from the
existing item:

```rust
"onAccess": [
    access(obj! {
        "effects": [
            effect::call("LoadItemForEdit", vec!["add-another".into(), "contacts".into(), CONTACT_FIELD_CODES.into()]),
        ],
    }),
],
```

`LoadItemForEdit` does three things:

1. Reads the `:index` route parameter to get the item position.
2. Copies each field from `contacts[index]` into the form context, so
   the inputs render pre-filled.
3. Stores the edit index in the session so the submission handler knows
   which item to replace.

On valid submission, `EditItemInCollection` replaces the item at the
stored index instead of appending:

```rust
"onSubmission": [
    submit(obj! {
        "validate": true,
        "onValid": obj! {
            "effects": [
                effect::call("EditItemInCollection", vec!["add-another".into(), "contacts".into(), CONTACT_FIELD_CODES.into()]),
                effect::call("SaveDraftAnswers", vec!["add-another".into()]),
            ],
            "next": [redirect(obj! { "goto": "your-contacts" })],
        },
    }),
],
```

`EditItemInCollection` bundles the current field answers into an
object, replaces the item at the stored index, clears the temporary
fields, and removes the stored index from the session. The redirect
sends the user back to the list page where the updated card appears.

---

### Saving state before redirecting

When the user clicks "Add another", the step saves draft answers
before redirecting. A non-validating submit hook handles this:

```rust
"onSubmission": [
    submit(obj! {
        "when": post("action").matches(condition::equals("add-another")),
        "validate": false,
        "onAlways": obj! {
            "effects": [effect::call("SaveDraftAnswers", vec!["add-another".into()])],
            "next": [redirect(obj! { "goto": "add-contact" })],
        },
    }),
],
```

`onAlways` runs before any redirect outcome, so the collection state
is persisted to the session before the redirect clears the form
context.

---

### Requiring at least one item

The list page has no fields of its own, so field-level validation does
not apply. Instead, a step-level `validWhen` rule checks that the
collection is not empty before the user can continue:

```rust
step(obj! {
    "code": "your-contacts",
    "path": "/your-contacts",
    "validWhen": [
        validation(obj! {
            "condition": answer("contacts").matches(condition::is_required()),
            "message": "Add at least one emergency contact",
        }),
    ],
    "onSubmission": [
        submit(obj! {
            "when": post("action").matches(condition::equals("add-another")),
            "validate": false,
            "onAlways": obj! {
                "next": [redirect(obj! { "goto": "add-contact" })],
            },
        }),
        submit(obj! {
            "when": post("action").matches(condition::equals("continue")),
            "validate": true,
            "onValid": obj! {
                "next": [redirect(obj! { "goto": "check-answers" })],
            },
        }),
    ],
})
```

`condition::is_required()` returns false for `undefined`, `null`, empty
strings, and empty arrays, so it catches both the case where no items
have been added and where all items have been removed.

The "add another" submission keeps `"validate": false` so the user is
never blocked from adding their first contact. Only the "continue"
submission sets `"validate": true`, which triggers the step-level rule
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

```rust
step(obj! {
    "code": "add-contact",
    "path": "/add-contact",
    "reachability": obj! { "entryWhen": true },
    // ...
})
```

An entry point is always independently reachable regardless of whether
earlier steps are valid. This gives us both properties:

- The list page blocks forward propagation to check-answers when
  empty (the `validWhen` rule fails).
- The add page remains reachable because it is an entry point, so the
  "add another" redirect always works.

In the demo, `"entryWhen": true` is fine because nothing precedes the
list page. In a real journey where earlier steps collect required
information first, make the entry conditional on state that proves
those steps are complete:

```rust
step(obj! {
    "code": "add-contact",
    "path": "/add-contact",
    "reachability": obj! {
        "entryWhen": answer("previousStepField").matches(condition::is_required()),
    },
    // ...
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
- **Minimum and maximum counts.** Use `answer("contacts")` with
  `transformer::array::length()` to gate the continue button or show
  a validation message. For example, requiring at least one contact
  before allowing the user to proceed.
- **Reorder items.** Add move-up and move-down links to each card
  that swap adjacent items in the array via a submit hook and
  effect.
