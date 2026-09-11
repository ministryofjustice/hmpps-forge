import { GovUKPanel, GovUKBody, GovUKButton } from '@ministryofjustice/hmpps-forge/govuk-components'
import { submit, redirect, Condition, Data, tieBreaker, step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { clearAnswers, clearDraftAnswers } from './effects'

const panel = GovUKPanel({
  titleText: 'Household saved',
})

const nextSteps = GovUKBody({
  text: 'Your household members have been saved to the answer store.',
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
  title: 'Household saved',
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
