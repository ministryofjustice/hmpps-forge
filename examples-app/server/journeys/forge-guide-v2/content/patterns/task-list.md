---
title: Task list
slug: task-list
section: patterns
path: patterns/task-list
nav: Entry and routing
order: 6
description: Complete independent sections and track progress before submitting an application.
---

# Task list

Use a task list when someone can complete parts of a larger application in their
own order. This prison-visit example has two initial sections, followed by an
additional-needs question and a final review.

## Try the pattern

1. Start either initial section and return to the task list after its first question.
2. Complete both initial sections and see the additional-needs task become available.
3. Complete that task, then open the final review and confirm the answers.

Edit the files below and select **Run** to try your changes. Running the edited
files starts a fresh preview.

:::playground
---
title: Task list
base: /assets/playground/task-list/
entry: journey.ts
start: /task-list/overview
---
journey.ts
effects.ts
AnswerStore.ts
additional-needs.ts
preferred-day.ts
confirmation.ts
overview.ts
relationship.ts
visit-preferences.ts
your-name.ts
tasks.ts
check-answers.ts
your-details.ts
visit-type.ts
:::

:::note
---
---
The preview keeps draft answers, task statuses and saved records in memory.
Restarting the preview or reloading the guide page clears them.
:::

## How it works

`tasks.ts` presents the sections and maps their status answers to task-list tags.
The section steps set an in-progress status after the first valid submission and
a completed status after the final one. Completion is explicit: it does not
have to be inferred from whether every possible answer has a value.

`your-details.ts` and `visit-preferences.ts` define child journeys. Their final
steps return to the parent task list. The additional-needs step becomes available
when both initial sections are complete; the final review is available after all
three tasks are complete. The task list shows these conditions through its links,
and the step definitions also control entry.

Draft answers and task statuses live in the preview session. Confirmation writes
a separate record through `AnswerStore.ts` and clears the draft. A saved record
keeps the confirmation page available after that clear.

## Adapting the pattern

Choose what “completed” means for each section, especially if editing one section
can invalidate another. Reset any affected status as part of that change. Task
availability describes progress through the application; access permissions still
need their own checks.
