import { submit, redirect, Condition, Data, tieBreaker, step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { clearAnswers, clearDraftAnswers } from './effects'
import { GovUKPanel, GovUKBody, GovUKButton } from '@ministryofjustice/hmpps-forge/govuk-components'

const panel = GovUKPanel({
  titleText: 'Address saved',
})

const nextSteps = GovUKBody({
  text: 'Your address has been saved to the answer store. Restart the pattern to clear it and try again.',
})

const restartButton = GovUKButton({
  text: 'Restart pattern',
  name: 'action',
  value: 'restart',
  classes: 'govuk-button--secondary',
})

export const confirmationStep = step({
  code: 'confirmation',
  path: '/confirmation',
  title: 'Address saved',
  reachability: {
    // A saved record keeps confirmation reachable after the drafts are cleared.
    entryWhen: Data('savedAnswers').match(Condition.IsRequired()),
    tieBreakers: [tieBreaker({ priority: 200 })],
  },
  blocks: [panel, nextSteps, restartButton],
  onSubmission: [
    submit({
      validate: false,
      onAlways: {
        effects: [
          clearAnswers(),
          clearDraftAnswers(),
        ],
        next: [redirect({ goto: 'overview' })],
      },
    }),
  ],
})
