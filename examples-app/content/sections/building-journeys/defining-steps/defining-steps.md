---
title: Defining steps
section: building-journeys
path: building-journeys/defining-steps
teaches: [step, StepDefinition, view-inheritance, backlink, cleardownFieldCodes, step-data, step-code]
prerequisites: [journey, JourneyDefinition, block, BlockDefinition]
---

<p class="govuk-caption-xl">Building flows and content</p>

# Defining steps

A step is a single page within a journey. It defines what users see
and how they interact with it: the content, the fields, and the
behaviour that runs when they arrive or submit.

{{slot:toc}}

---

## What is a step?

Where a journey describes the overall structure of a multi-page
experience, a step describes a single screen: what blocks appear on
it, what data it needs, and how it looks.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};

let add_trip_step = step(obj! {
    "path": "/add-trip",
    "title": "Add a trip",
    "blocks": [heading, country_field, departure_date_field, continue_button],
});
```

Like journeys, steps are declarations. A step does not execute anything
or hold state. It describes what a page looks like and what it needs.
Forge takes that definition, mounts a route for it, and handles the
rendering and request lifecycle.

Steps always belong to a journey. They are passed into the journey's
`steps` array, and their route is built by joining the step's `path`
with the parent journey's `path`:

```rust
journey(obj! {
    "path": "/travel-declaration",
    "steps": [add_trip_step], // → GET/POST /travel-declaration/add-trip
})
```

---

## How it works

When Forge compiles a journey, it processes each step in three ways:

1. **Mounts routes**: registers a GET and POST handler at the composed
   path. A step at `/add-trip` inside a journey at `/travel-declaration`
   becomes `/travel-declaration/add-trip`.
2. **Inherits configuration**: any `view` or `data` set on the parent
   journey flows down to the step. The step can override either.
3. **Registers in the route tree**: the step's `title`, `path`,
   and `metadata` are extracted into the
   [route tree](navigation-tree) so templates can render sidebars
   and breadcrumbs.

### Configuration inheritance

Configuration flows downward from journey to step. A `view` set on
the journey applies to every step unless a step provides its own
override.

```rust
let travel_journey = journey(obj! {
    "path": "/travel-declaration",
    "view": obj! {
        "template": "partials/form-page",
        "locals": obj! { "serviceName": "Declare your overseas travel" },
    },
    "steps": [add_trip_step, check_answers_step],
});
```

Both `addTripStep` and `checkAnswersStep` inherit the template and
locals. If `checkAnswersStep` needs a different template, it sets its
own `view`:

```rust
let check_answers_step = step(obj! {
    "path": "/check-answers",
    "title": "Check your travel declaration",
    "view": obj! { "template": "partials/check-answers" },
    "blocks": [heading, overview_summary, trip_summary_cards, submit_button],
});
```

The same inheritance applies to `data`. Static data set on a journey
is available to all its steps through `data()` expressions. A step
can add its own data, which merges with the journey data for that
step only.

---

## Organising step files

As a step grows, it helps to separate the step definition from its
blocks. A common pattern is to give each step its own directory:

```
travel-declaration/
├── journey.rs
└── steps/
    ├── add-trip/
    │   ├── step.rs
    │   └── blocks.rs
    ├── your-trips/
    │   ├── step.rs
    │   └── blocks.rs
    └── check-answers/
        ├── step.rs
        └── blocks.rs
```

The step file defines the structure and hooks. The blocks file
defines the content and fields:

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

// steps/add-trip/blocks.rs
let heading = govuk::HEADING.build(obj! { "text": "Add a trip", "size": "l" });
let country_field = govuk::SELECT_INPUT.build(obj! {
    "code": "tripCountry",
    "label": obj! { "text": "Which country did you visit?" },
    "items": data("countries"),
});
let continue_button = govuk::BUTTON.build(obj! { "text": "Save and continue" });
```

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};

// steps/add-trip/step.rs
let add_trip_step = step(obj! {
    "path": "/add-trip",
    "title": "Add a trip",
    "data": obj! { "countries": countries },
    "blocks": [heading, country_field, continue_button],
    "onSubmission": [
        submit(obj! {
            "validate": true,
            "onValid": obj! {
                "next": [redirect(obj! { "goto": "your-trips" })],
            },
        }),
    ],
});
```

This is a convention, not a requirement. Small steps with one or two
blocks work fine in a single file.

---

## Step properties

### `path` (Required)

The URL path segment for this step. Joined with the parent journey's
path to produce the full route.

```rust
"path": "/add-trip",
```

Paths must start with `/` and must be unique within the journey. If
two steps produce the same composed route, Forge fails with a
`DuplicateRouteError` at mount time.

Paths can include route parameters:

```rust
"path": "/prisoner/:prisonerId",
```

### `title` (Required)

The display name for the step. Used in the route tree, the page
title, and anywhere the step needs a human-readable label.

```rust
"title": "Add a trip",
```

### `code` (Optional)

A unique identifier for the step. Useful for programmatic references
where you need to identify a step without relying on its path.

```rust
"code": "add-trip",
```

### `description` (Optional)

A short description of the step. Passed through to the route tree and
available in templates.

```rust
"description": "Record the details of a single trip",
```

### `blocks` (Optional)

An array of block and field definitions that make up the page content.
The order in the array is the order on the page. See
[Defining blocks and fields](defining-blocks-and-fields) for how
blocks and fields work.

```rust
"blocks": [heading, country_field, departure_date_field, continue_button],
```

### `view` (Optional)

Controls rendering behaviour for this step. Overrides any `view` set
on the parent journey.

```rust
"view": obj! {
    "template": "partials/confirmation-page",
    "locals": obj! { "showBackLink": false },
},
```

| Property   | Description                                 |
|------------|---------------------------------------------|
| `template` | Template to use for rendering this step     |
| `locals`   | Arbitrary properties passed to the template |

### `backlink` (Optional)

Sets a custom back link URL. By default, Forge provides a back link
to the previous step on the user's path through the journey. Set a
custom URL to override this, or an empty string to remove the back
link entirely.

```rust
"backlink": "/travel-declaration/your-trips",
// Custom URL
"backlink": "",
// No back link
```

### `reachability` (Optional)

Marks the step as an entry point and configures tie-breaking behaviour.
`entryWhen` can be `true` (always an entry point) or a condition
expression (entry point only when the condition is met). `tieBreakers`
resolves ambiguity when Forge has multiple candidates - entry points,
paths to a step, or redirect targets.

```rust
"reachability": obj! { "entryWhen": true },
"reachability": obj! { "entryWhen": session("submitted").matches(condition::equals(true)) },
"reachability": obj! {
    "entryWhen": true,
    "tieBreakers": [tie_breaker(obj! { "priority": 100 })],
},
```

See [Routing and entry points](routing-and-entry-points) for how entry
points work, and [Reachability](reachability) for the redirect logic.

### `data` (Optional)

Static data attached to the step, available in blocks through `data()`
expressions. Merged with any data set on the parent journey, where
step values take precedence when keys overlap.

```rust
"data": obj! {
    "countries": [
        obj! { "value": "FR", "text": "France" },
        obj! { "value": "DE", "text": "Germany" },
    ],
},
```

```rust
// In a block:
govuk::SELECT_INPUT.build(obj! {
    "code": "country",
    "items": data("countries"),
})
```

### `metadata` (Optional)

Arbitrary data passed through to the route tree. Forge does not
use it internally. See [The route tree](navigation-tree) for how
to use metadata for grouping and display.

```rust
"metadata": obj! { "navGroup": "Core concepts", "hiddenFromNav": true },
```

### `cleardownFieldCodes` (Optional)

An array of field codes to clear when this step becomes unreachable.
Prevents stale answers from lingering when a user changes their path
through the journey. Supports exact field codes and regex patterns.

```rust
"cleardownFieldCodes": ["tripCountry", "tripDepartureDate", "^trip.*$"],
```

### `onAccess`, `onSubmission` (Optional)

Lifecycle hooks that run at different points in the request cycle.
These control data loading, POST actions, and form submission.
See [Hooks and lifecycle](hooks-and-lifecycle) for full details.

### `validWhen` (Optional)

Step-level validation rules that run alongside field-level validations.
Useful for cross-field rules that depend on multiple inputs. For running
validation when a user enters a step, see `validateOnEntry` in
[Validation](validation).

---

## Best practices

- **Keep steps focused on a single task.** "Add a trip" is one step.
  "Review your trips" is another. If a step has more than 7 or 8
  fields, consider whether it should be split.
- **Separate blocks into their own file when a step grows.** The step
  file should read like a summary: path, title, blocks, hooks.
  Move the block definitions next door.
- **Set `view` at the journey level, override at the step level.** Most
  steps in a journey share the same template. Only override where a
  step genuinely needs something different, like a confirmation page.
- **Use `data` for static values, effects for dynamic values.** A list
  of countries that never changes belongs in `data`. A list loaded from
  an API belongs in an access hook effect.
- **Use `code` when you need to reference a step programmatically.**
  Paths can change during development. Codes provide a stable handle.
