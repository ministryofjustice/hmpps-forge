import { submit, redirect, Post, Condition, step, Self, Transformer, validation, or, not } from '@ministryofjustice/hmpps-forge/core/authoring'
import { lookupAddress, saveDraftAnswers } from './effects'
import {
  GovUKTextInput,
  GovUKButton,
  GovUKButtonGroup,
  GovUKHeading,
  GovUKUtilityClasses,
} from '@ministryofjustice/hmpps-forge/govuk-components'

const heading = GovUKHeading({
  text: 'Find an address',
  size: 'l',
})

const postcodeField = GovUKTextInput({
  code: 'postcode',
  label: { text: 'Postcode' },
  hint: { text: 'Try SW1A 1AA, SW1A 2AA, or LS1 2BJ' },
  classes: GovUKUtilityClasses.Input.Width10,
  formatters: [Transformer.String.Trim()],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter a postcode',
      submissionOnly: true,
      groups: ['find-postcode'],
    }),
    validation({
      condition: or(
        not(Self().match(Condition.IsRequired())),
        Self().match(Condition.Address.IsValidPostcode()),
      ),
      message: 'Enter a valid postcode',
      submissionOnly: true,
      groups: ['find-postcode'],
    }),
  ],
})

const findAddressButton = GovUKButton({
  text: 'Find address',
  name: 'action',
  value: 'find-address',
  classes: 'govuk-button--secondary',
})

const addressLine1Field = GovUKTextInput({
  code: 'addressLine1',
  label: { text: 'Address line 1' },
  autocomplete: 'address-line1',
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter address line 1',
      groups: ['address'],
    }),
  ],
})

const addressLine2Field = GovUKTextInput({
  code: 'addressLine2',
  label: { text: 'Address line 2 (optional)' },
  autocomplete: 'address-line2',
})

const addressTownField = GovUKTextInput({
  code: 'addressTown',
  label: { text: 'Town or city' },
  autocomplete: 'address-level2',
  classes: GovUKUtilityClasses.Input.Width20,
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter a town or city',
      groups: ['address'],
    }),
  ],
})

const addressCountyField = GovUKTextInput({
  code: 'addressCounty',
  label: { text: 'County (optional)' },
  classes: GovUKUtilityClasses.Input.Width20,
})

const addressPostcodeField = GovUKTextInput({
  code: 'addressPostcode',
  label: { text: 'Postcode' },
  autocomplete: 'postal-code',
  classes: GovUKUtilityClasses.Input.Width10,
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter a postcode',
      groups: ['address'],
    }),
  ],
})

const buttonGroup = GovUKButtonGroup({
  buttons: [
    GovUKButton({
      text: 'Continue',
      name: 'action',
      value: 'continue',
    }),
  ],
})

export const findAddressStep = step({
  code: 'find-address',
  path: '/find-address',
  title: 'Find an address',
  reachability: { entryWhen: true },
  blocks: [
    heading,
    postcodeField,
    findAddressButton,
    addressLine1Field,
    addressLine2Field,
    addressTownField,
    addressCountyField,
    addressPostcodeField,
    buttonGroup,
  ],
  onSubmission: [
    submit({
      when: Post('action').match(Condition.Equals('find-address')),
      validate: { groups: ['find-postcode'] },
      onValid: {
        effects: [lookupAddress()],
      },
    }),
    submit({
      when: Post('action').match(Condition.Equals('continue')),
      validate: { groups: ['address'] },
      onValid: {
        effects: [saveDraftAnswers()],
        next: [redirect({ goto: 'check-answers' })],
      },
    }),
  ],
})
