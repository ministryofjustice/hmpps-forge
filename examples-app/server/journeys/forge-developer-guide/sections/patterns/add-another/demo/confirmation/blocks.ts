import { GovUKPanel, GovUKBody, GovUKButton } from '@ministryofjustice/hmpps-forge/govuk-components'

export const panel = GovUKPanel({
  titleText: 'Emergency contacts saved',
})

export const nextSteps = GovUKBody({
  text: 'Your contacts have been stored in the session. Restart the pattern to clear them and try again.',
})

export const restartButton = GovUKButton({
  text: 'Restart pattern',
  name: 'action',
  value: 'restart',
  classes: 'govuk-button--secondary',
})
