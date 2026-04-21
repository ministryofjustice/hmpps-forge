import { GovUKPanel, GovUKBody, GovUKButton } from '@ministryofjustice/hmpps-forge/govuk-components'

export const panel = GovUKPanel({
  titleText: 'Visit booked',
})

export const nextSteps = GovUKBody({
  text: 'Your answers have been stored in the session. Restart the pattern to clear them and try a different branch.',
})

export const restartButton = GovUKButton({
  text: 'Restart pattern',
  name: 'action',
  value: 'restart',
  classes: 'govuk-button--secondary',
})
