import { submit, redirect, Condition, Data, tieBreaker, step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { clearAnswers, clearDraftAnswers } from './effects'
import { GovUKPanel, GovUKBody, GovUKButton } from '@ministryofjustice/hmpps-forge/govuk-components'

const panel = GovUKPanel({
  titleText: 'Answers submitted',
})

const nextSteps = GovUKBody({
  text: 'Restart the pattern to try the resume flow again.',
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
  title: 'Answers submitted',
  reachability: {
    // A saved record keeps confirmation reachable after the drafts are cleared.
    entryWhen: Data('savedAnswers').match(Condition.IsRequired()),
    // Priority 200 wins over overview (100), so a submitted user lands here
    // instead of being sent back to the overview page.
    tieBreakers: [tieBreaker({ priority: 200 })],
  },
  blocks: [panel, nextSteps, restartButton],
  onSubmission: [
    submit({
      validate: false,
      onAlways: {
        // Reset everything so the user can start fresh
        effects: [
          clearAnswers(),
          clearDraftAnswers(),
        ],
        next: [redirect({ goto: 'overview' })],
      },
    }),
  ],
})
