---
title: Read-only mode
slug: read-only-mode
section: patterns
path: patterns/read-only-mode
nav: Access and permissions
order: 15
description: Show editable fields or a read-only summary according to the visitor's role
---

# Read-only mode

Present the same record as a summary or an editable form according to the user's
role. This example lets admins update contact records while viewers can read them.

## Try the pattern

1. Sign in as an admin, open a contact and save a change.
2. Sign out and sign in as a viewer within the same preview run.
3. Open that contact to see the saved change in a summary, without editable fields.

Edit the files below and select **Run** to try your changes. Running the edited
files starts a fresh preview.

:::playground
---
title: Read-only mode
base: /assets/playground/read-only-mode/
entry: journey.ts
start: /read-only-mode/overview
---
journey.ts
effects.ts
AnswerStore.ts
overview.ts
login.ts
contacts.ts
record.ts
:::

:::note
---
---
The preview keeps saved contacts and the simulated identity in memory. Restarting
the preview or reloading the guide page resets both.
:::

## How it works

`record.ts` defines `isAdmin` and `isViewer` expressions from the simulated session
identity. `visibleWhen` uses those expressions to show either the summary list or
the inputs and save button. Both presentations use the same loaded record values.

The save submission also has `when: isAdmin`. Hiding the button is therefore not
the only journey rule controlling the operation. A valid admin submission calls
`saveContact()` in `effects.ts`, which writes the selected record through the
injected answer store.

`AnswerStore.ts` keeps saved contacts separate from the simulated login session.
Signing out does not discard an admin's saved changes, which makes it possible
to inspect them as a viewer.

## Adapting the pattern

Choose a readable display for someone who cannot edit, rather than presenting a
page full of disabled inputs. In a real service, enforce permission to update the
record on the backend too: the browser's identity and visibility rules are not an
authorisation boundary.
