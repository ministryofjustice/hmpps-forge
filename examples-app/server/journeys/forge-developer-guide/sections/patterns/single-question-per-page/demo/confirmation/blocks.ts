import { GovUKPanel, GovUKBody, GovUKButton } from '@ministryofjustice/hmpps-forge/govuk-components'

export const panel = GovUKPanel({
  titleText: 'Answers saved',
})

export const nextSteps = GovUKBody({
  text: 'Your answers have been stored in the session. Reload any step to see your previous input.',
})

export const restartButton = GovUKButton({
  text: 'Restart pattern',
  name: 'action',
  value: 'restart',
  classes: 'govuk-button--secondary',
})
