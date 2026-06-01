---
title: Reveal fields
section: patterns
path: patterns/reveal-fields
teaches: [reveal-fields, conditional-reveal, dependentWhen, radio-block]
prerequisites: [GovUKRadioInput, dependentWhen, validWhen]
---

<p class="govuk-caption-xl">Patterns</p>

# Reveal fields
A radio question that reveals an extra input inline when the user
picks an option that needs more detail. The choice and its follow-up
are captured on a single page, rather than splitting into separate
steps per branch.

<p class="govuk-body"><a class="govuk-button" href="/forge-developer-guide/patterns/demos/reveal-fields" data-module="govuk-button">Try the live demo</a></p>

{{slot:toc}}

---

## When to use it

Reach for reveal fields when the follow-up is a small amount of
additional detail that logically belongs to the choice the user just
made. Typical cases are "please specify" for an Other option, or a
single text field whose meaning changes with the radio selection.

It fits well when:

- The follow-up is one or two fields at most.
- Every revealed field has the same layout and validation shape.
- Splitting into a separate page would feel like overkill.

If the follow-up is a full set of questions or has its own validation
and integration concerns, prefer
[Branching based on an earlier answer](branching) and give
each branch its own step.

---

## What the pattern covers

The live demo works end-to-end. Following the flow shows:

- **A radio field** with a `block` attached to specific options.
- **Follow-up inputs** that only apply when their parent option is
  selected, using `dependentWhen`.
- **A single step** that captures the choice and the follow-up
  together on one page.
- **A summary** whose follow-up rows appear only when the matching
  option was picked.

---

## Anatomy of the flow

```
/forge-developer-guide/patterns/demos/reveal-fields/
├── /                → Overview and "Start" button
├── /heard-from      → Radio with 2 revealed follow-ups
├── /check-answers   → Summary with conditional rows
└── /confirmation    → Panel and restart
```

Only one follow-up input is reachable per submission. The others are
still defined, but their values and validation are ignored while a
different option is selected.

---

## How it works

### Attaching a block to a radio option

Each entry in a `GovUKRadioInput`'s `items` array can carry a `block`
property. The GOV.UK radios template renders it inside a conditional
reveal that is only visible when the option is checked:

```typescript
GovUKRadioInput({
  code: 'heardFrom',
  items: [
    { value: 'search-engine', text: 'Search engine' },
    {
      value: 'social-media',
      text: 'Social media',
      block: GovUKTextInput({
        code: 'socialMediaSource',
        label: 'Which platform?',
        dependentWhen: Answer('heardFrom').match(Condition.Equals('social-media')),
        validWhen: [
          validation({
            condition: Self().match(Condition.IsRequired()),
            message: 'Enter the platform where you saw us',
          }),
        ],
      }),
    },
    { value: 'friend-or-colleague', text: 'Friend or colleague' },
    { value: 'other', text: 'Other', block: /* another reveal */ },
  ],
})
```

Options without a `block` behave as plain radios. The reveal is
purely cosmetic in the template; the wiring that makes Forge treat
the nested field as conditional is `dependentWhen`.

### dependentWhen on the nested field

`dependentWhen` tells Forge "only use this field's value and
validation when the condition is true." If the user picks a different
option, the nested field is ignored even if a stale value from an
earlier visit is still in the session. That means:

- The required-field validation does not fire when the parent option
  is not selected.
- The stored value is not used when evaluating expressions that read
  from `Answer('socialMediaSource')` on the next step.

Without `dependentWhen`, the nested field would always validate and
always contribute its answer, which defeats the point of the reveal.

### Showing follow-ups on the summary

The summary renders the radio's display label for every submission,
and uses `visibleWhen` to show the follow-up row only when its option
was picked:

```typescript
{
  key: { text: 'Platform' },
  value: { text: Answer('socialMediaSource') },
  actions: {
    items: [{ href: 'heard-from', text: 'Change', visuallyHiddenText: 'the platform' }],
  },
  visibleWhen: Answer('heardFrom').match(Condition.Equals('social-media')),
}
```

The change link takes the user back to the same radio step. The
reveal is populated automatically because the answer is still in the
session.

---

## Variations

- **Checkbox reveals.** `GovUKCheckboxInput` supports the same `block`
  shape. The reveal shows when that checkbox is checked, independent
  of the others.
- **Multiple fields in a reveal.** Pass an array of blocks to `block`
  to reveal more than one input under a single option. Keep it short;
  more than two fields is usually a sign that option should be its
  own page.
- **Reveal for Other only.** A common shape is a list of concrete
  options plus a single Other option with a `block` for a freetext
  explanation. The pattern scales down naturally to one revealed
  field.
- **Clearing stale follow-ups.** By default, switching options leaves
  the previously entered follow-up in the session. If the user flips
  back, they see their earlier answer. When that is not what you
  want, clear the stored value when the parent answer changes.
