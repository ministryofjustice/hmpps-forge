---
title: Patterns
section: patterns
path: patterns/overview
teaches: [patterns]
prerequisites: [journey, step]
---

<p class="govuk-caption-xl">Patterns</p>

# Patterns
Common shapes for the journeys you will build with Forge. Each pattern
pairs a short overview with a runnable demo, so you can try the flow,
inspect the code that produced it, and decide whether it fits your
service before adopting it.

{{slot:toc}}

---

## How this section is structured

Each pattern has two parts:

- **An overview page** in this section. It explains what the pattern
  does, when to reach for it, the tradeoffs, and any variations worth
  knowing about.
- **A live demo** mounted under the `/demos` sub-path. The demo
  opens in a split-screen view with the flow on the left and the code
  that produced each step on the right.

The overview pages link into the demo. You can also deep-link to any
step of a demo if you want to see how a specific interaction is
assembled.

---

## Patterns available

- [Single question per page](single-question-per-page) - A
  sequential flow that asks one question per page, validates each
  submission, and ends on a check-your-answers summary.
- [Branching based on an earlier answer](branching) - A
  flow that routes users down different paths based on an earlier
  answer, then converges on a shared check-your-answers summary.
- [Reveal fields](reveal-fields) - A radio question that
  reveals an extra input inline when the user picks an option that
  needs more detail, without leaving the page.
- [Multi-part composite fields](composite-fields) - Fields
  that are conceptually one value but collected through several
  inputs, covering both component-owned (date) and author-owned
  (address) flavours.
- [Resuming a partially-completed journey](resuming) - A
  landing page that detects saved progress and lets the user
  continue where they left off or clear their answers and start
  again.
- [Adding, editing and deleting from collections](add-another) - A
  list page that lets users build a collection one item at a time,
  displaying each entry as a summary card with change and remove
  links.
- [Task list](task-list) - A hub page that breaks a complex
  service into named tasks with completion statuses, letting users
  complete tasks in any order subject to prerequisites.
- [Load reference data on access](load-reference-data) - A step
  that loads data from an external source before the page renders,
  then displays the results through `Data()` references.
- [Pre-fill from an external system](pre-fill) - A form page that
  calls an external API mid-journey and populates fields with the
  response for the user to review or edit.
- [Repeating fieldsets](repeating-fieldsets) - A single page that
  collects a variable number of items through repeating groups of
  form fields, all editable at once and submitted together.
- [Edit and return](edit-and-return) - A check-your-answers page
  with change links that jump the user to a specific step and
  return them to the summary after saving.
- [Require authentication / role](auth-role) - A journey where
  some steps require the user to be authenticated and others
  require a specific role.
- [Read-only mode](read-only-mode) - A single page that renders
  editable form fields for one role and a read-only summary for
  another.
- [Search and select](search-and-select) - A search page where
  the user enters a query, results are fetched and displayed, and
  the user selects a result to view its details.
- [Pagination](pagination) - A paginated list that splits a large
  data set across multiple pages with Previous and Next links.
- [Shaping data inline](inline-functions) - Registering small
  transformers and conditions at the call site to reshape loaded
  data before rendering.
- [CMS content](cms-content) - A blog-style content management
  pattern where users write posts with a rich text editor and view
  them on a separate page.
- [Validating collections with iterators](collection-validation) -
  Validating that every item in a collection meets a set of rules,
  with a separate error message for each failing item.

More patterns are being added. If there is a pattern you need but do
not see here, open an issue or get in touch.
