import { GovUKPanel, GovUKBody, GovUKButton } from '@ministryofjustice/hmpps-forge/govuk-components'
import { submit, redirect, Condition, Data, tieBreaker, step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { clearAnswers, clearDraftAnswers } from './effects'

const panel = GovUKPanel({
  titleText: 'Plan agreed',
})

const nextSteps = GovUKBody({
  text: 'The sentence plan has been agreed. Restart the pattern to clear the saved plan and drafts and try again.',
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
  title: 'Plan agreed',
  reachability: {
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
