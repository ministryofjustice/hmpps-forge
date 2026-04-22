import { GovUKPanel, GovUKBody, GovUKButton } from '@ministryofjustice/hmpps-forge/govuk-components'

export const panel = GovUKPanel({
  titleText: 'Household saved',
})

export const nextSteps = GovUKBody({
  text: 'Your household members have been stored in the session.',
})

export const restartButton = GovUKButton({
  text: 'Restart pattern',
  name: 'action',
  value: 'restart',
  classes: 'govuk-button--secondary',
})
