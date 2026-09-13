---
title: Multi-part composite fields
slug: composite-fields
section: patterns
path: patterns/composite-fields
nav: Input and forms
order: 4
description: Collect a date and address through multiple inputs, then display them together
---

# Multi-part composite fields

Some answers naturally need several inputs. Keep those inputs together while
preparing a useful value for validation, storage and display. This example
collects a date of birth and a postal address.

## Try the pattern

1. Enter a date with a missing year, then an impossible date, to compare the errors.
2. Enter a valid past date and an address, leaving the optional address line empty.
3. Review the formatted answers and change the date to see its separate inputs again.

Edit the files below and select **Run** to try your changes. Running the edited
files starts a fresh preview.

:::playground
---
title: Composite fields
base: /assets/playground/composite-fields/
entry: journey.ts
start: /composite-fields/overview
---
journey.ts
effects.ts
AnswerStore.ts
overview.ts
date-of-birth.ts
address.ts
check-answers.ts
confirmation.ts
:::

:::note
---
---
The preview's storage lasts only until a restart or guide-page reload.
:::

## How it works

`date-of-birth.ts` uses `GovUKDateInputFull` for the day, month and year inputs.
The component provides the conversion between the input parts and a valid ISO
date string. Its validation distinguishes incomplete dates from invalid dates;
a further rule requires a date in the past.

`address.ts` collects separate address fields. In `check-answers.ts`, a generator
joins the non-empty address lines with commas. It supplies the summary's `text`
value, so the address is treated as text rather than HTML. The date summary uses
date transformers to show a readable date instead of the stored ISO value.

The input fields remain the source of the editable answers. Formatting a summary
does not require replacing them with the display text. On confirmation,
`effects.ts` saves a separate record through `AnswerStore.ts` and clears the draft.

## Adapting the pattern

Choose the input shape around the question people need to answer, and the saved
shape around how the service uses that answer. A formatted summary can bridge the
two without introducing a custom template for every combination of fields.
