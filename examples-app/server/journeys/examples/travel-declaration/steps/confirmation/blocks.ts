import {
  GovUKPanel,
  GovUKHeading,
  GovUKBody,
  GovUKButton,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const panel = GovUKPanel({
  titleText: 'Travel declaration submitted',
  html: 'Your overseas travel declaration has been recorded.',
})

export const whatHappensNextHeading = GovUKHeading({
  text: 'What happens next',
  size: 'm',
  level: 2,
})

export const nextStepsBody = GovUKBody({
  text: 'We will review your travel declaration and contact you if we need any further information. You do not need to do anything else.',
})

export const startAgainButton = GovUKButton({ text: 'Start again' })
