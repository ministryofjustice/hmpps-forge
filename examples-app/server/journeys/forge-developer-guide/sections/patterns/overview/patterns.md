---
title: Patterns
section: patterns
path: patterns
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

- [Single question per page](patterns/single-question-per-page) - A
  sequential flow that asks one question per page, validates each
  submission, and ends on a check-your-answers summary.
- [Branching based on an earlier answer](patterns/branching) - A
  flow that routes users down different paths based on an earlier
  answer, then converges on a shared check-your-answers summary.
- [Reveal fields](patterns/reveal-fields) - A radio question that
  reveals an extra input inline when the user picks an option that
  needs more detail, without leaving the page.
- [Multi-part composite fields](patterns/composite-fields) - Fields
  that are conceptually one value but collected through several
  inputs, covering both component-owned (date) and author-owned
  (address) flavours.
- [Resuming a partially-completed journey](patterns/resuming) - A
  landing page that detects saved progress and lets the user
  continue where they left off or clear their answers and start
  again.
- [Add another](patterns/add-another) - A list page that lets users
  build a collection one item at a time, displaying each entry as a
  summary card with a remove link.

More patterns are being added. If there is a pattern you need but do
not see here, open an issue or get in touch.
