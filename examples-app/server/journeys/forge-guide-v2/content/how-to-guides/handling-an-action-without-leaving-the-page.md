---
title: Handling an action without leaving the page
slug: handling-an-action-without-leaving-the-page
section: how-to-guides
path: how-to-guides/handling-an-action-without-leaving-the-page
nav: Loading and saving data
order: 10
description: Find addresses on the current page, then validate and save the selected address when the user continues
teaches: [submit-hooks, Post, validation-groups, onAlways, request-data, effects, same-page-actions]
prerequisites: [saving-answers-and-data-from-your-steps, how-validation-works]
related:
  concept: [how-forge-runs-a-request, how-answers-work, returning-a-page-redirect-or-error]
  how-to: [loading-data-for-use-in-your-steps, handling-missing-data-and-service-failures, testing-a-journey]
  reference: [submit, post, validation, effect]
---

# Handling an action without leaving the page

Sometimes a button helps somebody finish the page they're already on. Finding an address
is a familiar example: enter a postcode, load the matching addresses, then choose one
before continuing.

We'll add that interaction to our case journey. “Find address” will update the choices
on the current page. “Continue” will check the selection, save it, and return to the
case overview.

## Start with the two actions

Here's the page we're building toward:

:::preview
---
slot: address-lookup-initial
title: Before lookup
caption: The postcode lookup and address selection share one page.
---
:::

Let's start with a postcode field, a few placeholder addresses, and the two buttons.
Add this step to the case journey at `/cases/:caseId`, alongside its existing overview:

```typescript [[1, 20, "name: 'action'"], [1, 21, "value: 'find-address'"], [1, 35, "name: 'action'"], [1, 36, "value: 'continue'"]]
import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKButton,
  GovUKSelectInput,
  GovUKTextInput,
} from '@ministryofjustice/hmpps-forge/govuk-components'

const addressStep = step({
  path: '/address',
  title: 'Change case address',
  reachability: { entryWhen: true },
  blocks: [
    GovUKTextInput({
      code: 'postcode',
      label: 'Postcode',
      classes: 'govuk-input--width-10',
    }),
    GovUKButton({
      text: 'Find address',
      name: 'action',
      value: 'find-address',
      classes: 'govuk-button--secondary',
    }),
    GovUKSelectInput({
      code: 'addressId',
      label: 'Select an address',
      items: [
        { value: '', text: 'Select an address' },
        { value: 'address-1', text: '1 Example Street, London, SW1H 9AJ' },
        { value: 'address-2', text: '2 Example Street, London, SW1H 9AJ' },
      ],
    }),
    GovUKButton({
      text: 'Continue',
      name: 'action',
      value: 'continue',
    }),
  ],
})
```

Open `/cases/C12345/address` and check the page layout. Both buttons submit this form,
but each sends a different <s1>action value</s1>. Clicking “Find address” posts
`action=find-address`, alongside the postcode and selected address.

The button's `action` is raw submitted data. It doesn't need a field or an answer slot.
We'll use `Post('action')` to choose the submit hook that handles it.

## Check the postcode before looking it up

The lookup needs a postcode, but it doesn't need a selected address yet. Let's give
postcode validation its own group while keeping it in the normal page checks too.

Replace the postcode field:

```typescript [[2, 11, "formatters: [Transformer.String.Trim()]"], [3, 15, "groups: ['default', 'lookup']"]]
import {
  Condition,
  Self,
  Transformer,
  validation,
} from '@ministryofjustice/hmpps-forge/core/authoring'

GovUKTextInput({
  code: 'postcode',
  label: 'Postcode',
  formatters: [Transformer.String.Trim()],
  classes: 'govuk-input--width-10',
  validWhen: [
    validation({
      groups: ['default', 'lookup'],
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter a postcode',
    }),
  ],
})
```

The <s2>formatter</s2> trims the submitted postcode before the effect reads it.
The required rule belongs to <s3>both groups</s3>: `lookup` for finding addresses,
and `default` for continuing. A rule with no `groups` belongs to `default`.

Now create the loading effect in `addressEffects.ts`. Our address service accepts a
postcode and returns matching records:

```typescript [[4, 13, "effect('Cases.LoadAddresses'"], [2, 15, "context.getAnswer<string | undefined>('postcode')"], [5, 20, "context.setData('addressIds'"], [5, 21, "context.setData('addressItems'"]]
import { effect } from '@ministryofjustice/hmpps-forge/core/authoring'

interface Address {
  id: string
  label: string
}

interface AddressService {
  findByPostcode(postcode: string): Promise<Address[]>
  saveCaseAddress(caseId: string, addressId: string): Promise<void>
}

export const LoadAddresses = effect('Cases.LoadAddresses', {
  factory: (deps: { addressService: AddressService }) => async context => {
    const postcode = context.getAnswer<string | undefined>('postcode')
    const addresses = postcode
      ? await deps.addressService.findByPostcode(postcode)
      : []

    context.setData('addressIds', addresses.map(address => address.id))
    context.setData('addressItems', [
      {
        value: '',
        text: addresses.length ? 'Select an address' : 'No addresses found. Try another postcode.',
      },
      ...addresses.map(address => ({ value: address.id, text: address.label })),
    ])
  },
})
```

The <s4>loading effect</s4> reads the <s2>prepared answer</s2>, calls the service,
and stores <s5>items and IDs for this request</s5>. The items fill the select, and the
IDs will let us check the choice before saving.

The empty-postcode guard also lets us reuse this effect before validation later. It
returns empty choices without calling the service when there's nothing to look up.
Supply your `addressService` when registering the case package, alongside its existing dependencies.

## Load the choices and render the same page

Replace the select's hardcoded `items` with `Data('addressItems')`. Add initial items to
the step's `data`, then give the lookup its submit hook:

```typescript [[5, 13, "addressItems: [{ value: '', text: 'Enter a postcode and find an address' }]"], [5, 21, "Data('addressItems')"], [1, 27, "Post('action')"], [3, 28, "validate: { groups: ['lookup'] }"], [4, 30, "LoadAddresses()"]]
import {
  Data,
  Post,
  submit,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import { LoadAddresses } from './addressEffects'

const addressStep = step({
  path: '/address',
  title: 'Change case address',
  reachability: { entryWhen: true },
  data: {
    addressItems: [{ value: '', text: 'Enter a postcode and find an address' }],
    addressIds: [],
  },
  blocks: [
    // Keep the postcode field and Find address button here.
    GovUKSelectInput({
      code: 'addressId',
      label: 'Select an address',
      items: Data('addressItems'),
    }),
    // Keep the Continue button here.
  ],
  onSubmission: [
    submit({
      when: Post('action').match(Condition.Equals('find-address')),
      validate: { groups: ['lookup'] },
      onValid: {
        effects: [LoadAddresses()],
      },
    }),
  ],
})
```

The <s1>action</s1> selects this hook. It checks only the <s3>lookup group</s3>,
then runs the <s4>loading effect</s4> when the postcode passes.

There's no redirect in this hook. After the effect finishes, Forge resolves and renders
the current page using the new <s5>address items</s5>. This is still the same `POST`,
so the postcode remains available without saving it between requests.

Try “Find address” with an empty postcode. The page shows “Enter a postcode” without
calling the service. Now use a postcode your service returns addresses for and try again.
The URL stays the same, and the select contains the returned choices.

:::preview
---
slot: address-lookup-results
title: Address results
caption: After finding addresses, the user can choose one before continuing.
---
:::

A lookup with no matches shows “No addresses found. Try another postcode.” The user can
change the postcode and run the lookup again.

## Check the choice and save on continue

Finding addresses doesn't save a case address. We'll keep that work in a separate effect.
Add this definition to `addressEffects.ts`:

```typescript [[6, 1, "effect('Cases.SaveCaseAddress'"], [2, 4, "context.getAnswer<string>('addressId')"]]
export const SaveCaseAddress = effect('Cases.SaveCaseAddress', {
  factory: (deps: { addressService: AddressService }) =>
    async (context, caseId: string) => {
      const addressId = context.getAnswer<string>('addressId')

      await deps.addressService.saveCaseAddress(caseId, addressId)
    },
})
```

The <s6>saving effect</s6> reads the selected <s2>answer</s2>. Before calling it,
we need to check that the user selected an address returned for their postcode.

Add these rules to the select field:

```typescript [[5, 4, "Data('addressItems')"], [3, 6, "validation({"], [7, 11, "submissionOnly: true"], [5, 13, "Data('addressIds')"]]
GovUKSelectInput({
  code: 'addressId',
  label: 'Select an address',
  items: Data('addressItems'),
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Select an address',
    }),
    validation({
      submissionOnly: true,
      condition: Self().match(
        Condition.Array.IsIn(Data('addressIds')),
      ),
      message: 'Select an address from the current results',
    }),
  ],
})
```

Both rules use the <s3>default group</s3>, so finding addresses doesn't run them.
The required rule also tells Forge that an address is needed for journey progress.

The membership rule uses the <s5>IDs from this lookup</s5>. It's
<s7>submission-only</s7> because those results belong to the current submission,
not the earlier reachability check. The select's `items` control its choices on screen.
They don't validate a submitted value against that list for us.

There's one more piece: clicking “Continue” starts a fresh request. The previous lookup's
`Data('addressIds')` and `Data('addressItems')` don't carry over. The browser posts the
postcode and selected ID again, so we can load the matching addresses again too.

Replace `onSubmission` with these two hooks:

```typescript [[1, 9, "Post('action')"], [3, 10, "validate: { groups: ['lookup'] }"], [4, 12, "LoadAddresses()"], [8, 16, "onAlways: {"], [4, 17, "LoadAddresses()"], [3, 19, "validate: true"], [6, 21, "SaveCaseAddress(Params('caseId'))"], [9, 22, "redirect({ goto: 'overview' })"]]
import {
  Params,
  redirect,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import { LoadAddresses, SaveCaseAddress } from './addressEffects'

onSubmission: [
  submit({
    when: Post('action').match(Condition.Equals('find-address')),
    validate: { groups: ['lookup'] },
    onValid: {
      effects: [LoadAddresses()],
    },
  }),
  submit({
    onAlways: {
      effects: [LoadAddresses()],
    },
    validate: true,
    onValid: {
      effects: [SaveCaseAddress(Params('caseId'))],
      next: [redirect({ goto: 'overview' })],
    },
  }),
],
```

Forge uses the first matching hook. A <s1>find-address action</s1> runs the lookup hook,
and no later hook runs, even though the lookup doesn't redirect.

Other submissions reach the second hook. Its <s8>always branch</s8> reloads the addresses
before <s3>validation</s3>. The selected ID can now be checked against the current results.
Only the valid branch runs the <s6>save</s6> and <s9>redirects to the overview</s9>.

If validation fails, the page renders again with its errors and the freshly loaded choices.
If somebody changes the postcode before continuing, an address outside the new results
fails validation instead of being saved.

Try the complete interaction: find addresses, select one, and continue. Then try continuing
without a selection. The first request saves and redirects. The second stays on the page
and asks for an address.

Our existing package collects both effects through their calls in the journey. For service
failures, follow [Handling missing data and service failures](./handling-missing-data-and-service-failures).

## Recap

We now have two actions on one page, with a different job for each.

Let's recap the key points.

- Give buttons an action value and read it with `Post('action')`.
- Put the specific action first. Only one matching submit hook owns the request.
- Choose validation groups for the work that action needs.
- Omit a redirect when the current request needs to render the same page.
- Read prepared field values with `context.getAnswer()`.
- Reload request data when a later submission needs it.
- Use `onAlways` for loading needed before validation, and `onValid` for saving valid answers.
