---
title: Defining a journey
section: building-journeys
path: building-journeys/defining-a-journey
teaches: [journey, JourneyDefinition, path, code, title, view, data, metadata, createForgePackage]
prerequisites: []
---

<p class="govuk-caption-xl">Building flows and content</p>

# Defining a journey
A journey is the starting point for everything you build with Forge.
It defines the pages, structure, and configuration that make up a
multi-page form.

{{slot:toc}}

---

## What is a journey?

A journey describes a multi-page experience: the pages it contains, how
they're organised, and how users move through them. It's the starting point
for everything you build with Forge.

```typescript
import { journey } from '@ministryofjustice/hmpps-forge/core/authoring'

const travelDeclaration = journey({
  code: 'travel-declaration',
  title: 'Travel declaration',
  path: '/travel-declaration',
  steps: [yourTripsStep, addTripStep, checkAnswersStep],
})
```

A journey is a declaration, not a runtime process. It doesn't execute anything
or hold state. It describes structure: what steps exist, where they live, and
how they're configured. Forge takes that definition, compiles it, mounts
routes for each step, and builds a navigation tree. But the journey itself
is just data.

---

## How it works

When Forge receives a journey definition, it does three things:

1. **Compiles**: walks the definition and builds an internal representation.
   Validates that variants are registered, expressions are well-formed, and
   paths do not collide.
2. **Mounts routes**: registers GET and POST handlers for each step under
   the journey's `path`. A journey at `/travel-declaration` with a step at
   `/your-trips` produces the route `/travel-declaration/your-trips`.
3. **Builds navigation**: extracts `title`, `path`, and `metadata` from the
   journey and its steps to produce a navigation tree. This tree is available
   in your templates for rendering sidebars, breadcrumbs, and menus.

```
journey({ path: '/travel-declaration', ... })
├── step({ path: '/your-trips' })     → GET/POST /travel-declaration/your-trips
├── step({ path: '/add-trip' })       → GET/POST /travel-declaration/add-trip
└── step({ path: '/check-answers' })  → GET/POST /travel-declaration/check-answers
```

Configuration flows downward. A `view` set on the journey applies to all its
steps unless a step provides its own override. This means you set shared
configuration once at the journey level, such as templates, layout options
and other rendering concerns, and only override where a step needs
something different.

---

## Packaging a journey

Before Forge can use a journey, it needs to be bundled into a package using
`createForgePackage`. A package brings together the journey definition with
any custom functions and components it depends on:

```typescript
import { createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'

export default createForgePackage<MyDeps>({
  journey: travelDeclaration,
  components: [myCustomCard],
  functions: {
    ...myEffectsImplementations,
  },
})
```

If your journey only uses built-in components and has no custom functions,
the package is just a wrapper around the journey:

```typescript
export default createForgePackage({
  journey: travelDeclaration,
})
```

The package is what you pass to `forge.registerPackage()` at startup. This is
where Forge discovers your journey, compiles it, and mounts its routes.

---

## Journey properties

### `path` (Required)

The URL path prefix for this journey. All steps within the journey are mounted
under this path.

```typescript
path: '/travel-declaration'
```

Paths compose through the hierarchy. A nested child journey's path is appended
to its parent's.

### `code` (Required)

A unique identifier for the journey. Used for programmatic references, not
displayed to users.

```typescript
code: 'travel-declaration'
```

### `title` (Required)

The display name for the journey. Used in the navigation tree, breadcrumbs,
and anywhere the journey needs a human-readable label.

```typescript
title: 'Travel declaration'
```

### `steps` (Optional)

An array of step definitions that belong to this journey. The order in the
array determines the default navigation order.

```typescript
steps: [yourTripsStep, addTripStep, checkAnswersStep]
```

### `children` (Optional)

An array of child journey definitions nested under this journey. Each
child is a full journey definition with its own `steps`, `children`,
`view`, `onAccess`, `data`, and `metadata`. Child journey paths are
appended to the parent's path automatically.

```typescript
journey({
  code: 'case-management',
  title: 'Case management',
  path: '/case-management',
  children: [contactsJourney, notesJourney],
  steps: [dashboardStep],
})
```

A step at `/list` inside `contactsJourney` at `/contacts` produces the
route `/case-management/contacts/list`. See
[The navigation tree](navigation-tree) for how nesting shapes the
navigation structure.

### `description` (Optional)

A short description of the journey. Passed through to the navigation tree
and available in templates.

```typescript
description: 'Declare business travel for approval'
```

### `view` (Optional)

Controls rendering behaviour for the journey and its steps. Properties set
here are inherited by all steps unless overridden.

```typescript
view: {
  template: 'partials/guide-step',
  locals: { showBackToTop: true },
}
```

| Property   | Description                                         |
|------------|-----------------------------------------------------|
| `template` | Template to use for rendering steps in this journey |
| `locals`   | Arbitrary properties passed to the template         |

### `entryPath` (Optional)

The path users land on when they navigate to the journey's root URL. If not
set, Forge uses the first step with `isEntryPoint: true`. See
[Routing and entry points](routing-and-entry-points).

### `onAccess` (Optional)

An array of access hooks that run when any step in the journey is
accessed. Use these for journey-wide concerns like loading shared data or
checking permissions.

When a journey has children, `onAccess` hooks run for every step in
every child journey too. Forge executes them from the outermost ancestor
inward: root journey first, then child journey, then the step's own
hooks.

```typescript
onAccess: [
  access({
    effects: [MyEffects.LoadUserProfile()],
  }),
]
```

### `data` (Optional)

Static data attached to the journey, available in steps via `Data()`
expressions.

```typescript
data: {
  maxTrips: 10,
  supportEmail: 'travel@example.com',
}
```

```typescript
// In a step's block:
block({
  variant: 'html',
  content: Format('You can add up to %1 trips.', Data('maxTrips')),
})
```

### `metadata` (Optional)

Arbitrary data attached to the journey. Forge does not use it internally. It's
passed through to the navigation tree for your templates to use.

```typescript
metadata: {
  navGroup: 'Declarations',
  phase: 'beta',
}
```

---

## Best practices

- **Keep journeys focused on a single purpose.** A travel declaration is one
  journey. An expense claim is another. If a journey grows too large,
  consider breaking it into nested child journeys.
- **Use `code` for programmatic references, `title` for display.** Codes are
  stable identifiers that won't change when you rename things for users.
- **Set `view.template` at the journey level.** Override at the step level
  only when a step genuinely needs a different layout.
- **Use `data` for configuration that steps need.** It's simpler than loading
  static values through effects.
- **Nest when steps share a boundary.** If a group of steps shares access
  hooks, a template, or a logical section in the navigation, a child
  journey is a good fit. Avoid single-step children as they add structure
  without benefit.
