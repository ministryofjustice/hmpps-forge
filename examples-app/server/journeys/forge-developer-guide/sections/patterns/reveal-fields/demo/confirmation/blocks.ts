import { GovUKPanel, GovUKBody, GovUKButton } from '@ministryofjustice/hmpps-forge/govuk-components'

export const panel = GovUKPanel({
  titleText: 'Thanks for letting us know',
})

export const nextSteps = GovUKBody({
  text: 'Your answers have been stored in the session. Restart the pattern to clear them and try a different option.',
})

export const restartButton = GovUKButton({
  text: 'Restart pattern',
  name: 'action',
  value: 'restart',
  classes: 'govuk-button--secondary',
})
