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

Open the same contact record as an admin or a viewer. Admins can edit and save;
viewers see a summary. Role checks control both the displayed blocks and saving.

The login is simulated for this example. Contact records live in a separate
in-memory answer store, so logging out keeps saved edits. Edit the files below
and select **Run** to try your changes.

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
