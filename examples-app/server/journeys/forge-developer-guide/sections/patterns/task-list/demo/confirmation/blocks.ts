import {
  GovUKPanel,
  GovUKBody,
  GovUKButton,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const panel = GovUKPanel({
  titleText: 'Application submitted',
  text: 'Your visit request has been sent.',
})

export const whatNext = GovUKBody({
  text: 'We will review your application and send a confirmation email within 3 working days.',
})

// Posts action='restart' to trigger the onSubmission handler that resets the journey
export const restartButton = GovUKButton({
  text: 'Start a new application',
  name: 'action',
  value: 'restart',
  classes: 'govuk-button--secondary',
})
