---
title: Pre-fill from an external system
slug: pre-fill
section: patterns
path: patterns/pre-fill
nav: Data and integrations
order: 11
description: Try an address lookup that pre-fills editable fields without leaving the page
---

# Pre-fill from an external system

Offer a lookup to reduce typing while allowing someone to correct the result.
This example finds an address from a postcode and fills ordinary editable address
fields on the same page.

## Try the pattern

1. Enter `SW1A 1AA` and select **Find address**.
2. Change one of the returned address fields, then continue and review the edited value.
3. Try the lookup with no postcode, and try continuing with a required address field empty.

Edit the files below and select **Run** to try your changes. Running the edited
files starts a fresh preview.

:::playground
---
title: Pre-fill
base: /assets/playground/pre-fill/
entry: journey.ts
start: /pre-fill/overview
---
journey.ts
effects.ts
AnswerStore.ts
AddressLookup.ts
overview.ts
find-address.ts
check-answers.ts
confirmation.ts
:::

:::note
---
---
`AddressLookup.ts` contains local example responses, including a made-up
fallback address for unrecognised postcodes. It is not a live postcode service.

The preview's storage is in memory and is lost on a restart or guide-page
reload.
:::

## How it works

The lookup and continue buttons use different validation groups. Finding an
address validates the postcode without requiring the address fields to be filled
already. Continuing validates the address that will be saved.

`lookupAddress()` in `effects.ts` reads the postcode and calls the injected
`AddressLookup`. It writes the returned values with `setAnswer()`, so they appear
in the form and can be edited. The lookup action stays on the same page; it does
not submit the completed address or take the user to review.

Final confirmation saves the accepted answers through `AnswerStore.ts` and clears
the draft.

## Adapting the pattern

Keep a manual route through the form when a lookup cannot help. In a real
integration, distinguish no match from a failed request and let the user recover.
Use answers for values the person can edit; use `Data()` for supporting information
such as lookup choices or explanatory text.
