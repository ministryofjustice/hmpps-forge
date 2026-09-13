import type { BlockDefinition } from '@ministryofjustice/hmpps-forge/core/components'
import {
  GovUKButton,
  GovUKHeading,
  GovUKSelectInput,
  GovUKTextInput,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const previews: Record<string, BlockDefinition[]> = Object.fromEntries(
  ['initial', 'results'].map(state => {
    const slot = `address-lookup-${state}`
    const hasResults = state === 'results'

    return [
      slot,
      [
        GovUKHeading({ text: 'Change case address', size: 'm', level: 3 }),
        GovUKTextInput({
          code: `${slot}-postcode`,
          label: 'Postcode',
          classes: 'govuk-input--width-10',
          defaultValue: hasResults ? 'SW1H 9AJ' : '',
          disabled: true,
        }),
        GovUKButton({
          text: 'Find address',
          buttonType: 'button',
          classes: 'govuk-button--secondary',
          disabled: true,
        }),
        GovUKSelectInput({
          code: `${slot}-address`,
          label: 'Select an address',
          defaultValue: hasResults ? 'address-1' : '',
          items: hasResults
            ? [
                { value: '', text: 'Select an address' },
                { value: 'address-1', text: '1 Example Street, London, SW1H 9AJ' },
                { value: 'address-2', text: '2 Example Street, London, SW1H 9AJ' },
              ]
            : [{ value: '', text: 'Enter a postcode and find an address' }],
          disabled: true,
        }),
        GovUKButton({ text: 'Continue', buttonType: 'button', disabled: true }),
      ],
    ]
  }),
)
