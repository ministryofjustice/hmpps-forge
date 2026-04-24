import {
  Self,
  Condition,
  Transformer,
  validation,
  or,
  not,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKTextInput,
  GovUKButton,
  GovUKButtonGroup,
  GovUKHeading,
  GovukUtilityClasses,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const heading = GovUKHeading({
  text: 'Find an address',
  size: 'l',
})

export const postcodeField = GovUKTextInput({
  code: 'postcode',
  label: { text: 'Postcode' },
  hint: { text: 'Try SW1A 1AA, SW1A 2AA, or LS1 2BJ' },
  classes: GovukUtilityClasses.Input.Width10,
  formatters: [Transformer.String.Trim()],
  validWhen: [
    validation({
      condition: or(
        not(Self().match(Condition.IsRequired())),
        Self().match(Condition.Address.IsValidPostcode()),
      ),
      message: 'Enter a valid postcode',
      submissionOnly: true,
    }),
  ],
})

export const findAddressButton = GovUKButton({
  text: 'Find address',
  name: 'action',
  value: 'find-address',
  classes: 'govuk-button--secondary',
})

export const addressLine1Field = GovUKTextInput({
  code: 'addressLine1',
  label: { text: 'Address line 1' },
  autocomplete: 'address-line1',
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter address line 1',
    }),
  ],
})

export const addressLine2Field = GovUKTextInput({
  code: 'addressLine2',
  label: { text: 'Address line 2 (optional)' },
  autocomplete: 'address-line2',
})

export const addressTownField = GovUKTextInput({
  code: 'addressTown',
  label: { text: 'Town or city' },
  autocomplete: 'address-level2',
  classes: GovukUtilityClasses.Input.Width20,
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter a town or city',
    }),
  ],
})

export const addressCountyField = GovUKTextInput({
  code: 'addressCounty',
  label: { text: 'County (optional)' },
  classes: GovukUtilityClasses.Input.Width20,
})

export const addressPostcodeField = GovUKTextInput({
  code: 'addressPostcode',
  label: { text: 'Postcode' },
  autocomplete: 'postal-code',
  classes: GovukUtilityClasses.Input.Width10,
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter a postcode',
    }),
  ],
})

export const buttonGroup = GovUKButtonGroup({
  buttons: [
    GovUKButton({
      text: 'Continue',
      name: 'action',
      value: 'continue',
    }),
  ],
})
