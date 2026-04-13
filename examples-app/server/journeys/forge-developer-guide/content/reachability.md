---
title: Reachability
section: building-journeys
path: building-journeys/reachability
teaches: [reachability, reachability-redirects, field-cleardown, cleardownFieldCodes, getFieldsToClear]
prerequisites: [routing, entryPath, isEntryPoint]
---

<p class="govuk-caption-xl">Routing, reachability and navigation</p>

# Reachability
Reachability controls which steps a user can access based on their
progress through a journey. It prevents users from skipping ahead and
keeps stored answers in sync with the path they actually took.

{{slot:toc}}

---

## What is reachability?

In a sequential journey, users should not be able to jump to step 5
by typing its URL when they have only completed step 2. Reachability
enforces this. On every request, Forge evaluates which steps the user
can currently reach and redirects them if they try to access one they
have not.

Reachability also has a data dimension. When a user goes back and
changes an earlier answer, steps that were previously reachable may
no longer be. Any answers stored for those steps become stale and need
to be cleared so that outdated data does not follow the user through
the rest of the journey.

---

## How it works

### Redirect logic

On each GET and POST request, Forge walks through hooks from the entry
point to determine which steps are reachable. If the requested step is
not reachable, Forge redirects the user. The redirect target is chosen
in this order:

1. If exactly one reachable step is invalid (has validation failures),
   redirect there. This is the step blocking progress.
2. Otherwise, redirect to the first reachable entry point step.
3. If no entry point is reachable, redirect to the first step in the
   journey.

This means users cannot skip ahead by typing a URL directly. They are
sent back to the step that needs their attention.

### Tracking field ownership

Forge automatically tracks which field codes belong to each step. When
it evaluates reachability, it builds an inventory of every field on
every step, so it knows which answers belong to unreachable steps
without any extra configuration.

This works well for fields with static codes:

```typescript
const countryField = GovUKSelectInput({
  code: 'tripCountry',
  label: { text: 'Which country did you visit?' },
  items: Data('countries'),
})
```

Forge sees that `tripCountry` belongs to whichever step contains this
field. If that step becomes unreachable, `tripCountry` is identified as
a stale answer.

### Dynamic field codes and cleardown patterns

Some field codes are dynamic. Fields inside iterators, or fields whose
codes are built from data at runtime, produce codes that the engine
cannot predict during its analysis. For example, an iterator that
creates a field per item in a list might produce codes like `note-0`,
`note-1`, `note-2`. Forge cannot know these codes ahead of time because
they depend on runtime data.

This is where `cleardownFieldCodes` comes in. It lets you declare
patterns that match dynamic field codes, so Forge can identify them as
stale when the step becomes unreachable:

```typescript
const addNotesStep = step({
  path: '/add-notes',
  title: 'Add notes',
  cleardownFieldCodes: ['^note-\\d+$'],
  blocks: [heading, notesIterator, continueButton],
})
```

Patterns are matched as regular expressions against all stored answer
keys. You can mix exact codes and patterns in the same array:

```typescript
cleardownFieldCodes: ['tripCountry', 'tripDepartureDate', '^trip.*$']
```

The resolved list of stale answers is available to effect functions
through `getFieldsToClear()`, which combines both the automatically
discovered field codes and any `cleardownFieldCodes` patterns. The
actual clearing is performed in your effects, giving you control over
how and when answers are removed.

### Disabling reachability checks

If your journey is mainly for display rather than a sequential form
(like this developer guide), reachability checks get in the way. Every
step would need hooks connecting them, even though users should be
free to visit any page in any order.

To disable reachability checks, set `isEntryPoint: true` on every step.
A step marked as an entry point is always considered reachable, so Forge
will never redirect users away from it.

```typescript
const blocksStep = step({
  path: '/blocks',
  title: 'Blocks',
  isEntryPoint: true,
  ...
})

const fieldsStep = step({
  path: '/fields',
  title: 'Fields',
  isEntryPoint: true,
  ...
})
```

---

## API surface

### `cleardownFieldCodes` (Optional)

An array of patterns to match against stored answer keys when this step
becomes unreachable. Each pattern is tested as a regular expression.
Use exact field codes for known fields, and regex patterns for dynamic
field codes.

```typescript
cleardownFieldCodes: ['tripCountry', '^trip.*$']
```

Defined on the step definition. See
[Defining steps](defining-steps) for other step properties.

### `getFieldsToClear()`

Returns an array of answer keys that belong to unreachable steps or
match `cleardownFieldCodes` patterns on unreachable steps. Available
on the effect function context.

```typescript
const staleKeys = context.getFieldsToClear()
```

---

## Best practices

- **Do not rely on step ordering for reachability.** Reachability is
  determined by hooks, not by the order steps appear in the array.
  If a step has no hook leading to it, it will not be reachable
  regardless of its position.
- **Use `cleardownFieldCodes` for any step with dynamic field codes.**
  If a step uses iterators or computed field codes, the engine cannot
  track them automatically. Declare patterns so stale answers are
  identified when the step becomes unreachable.
- **Prefer regex patterns over listing every possible code.** A pattern
  like `'^note-\\d+$'` covers all iterator-generated codes without
  needing to know the exact count.
