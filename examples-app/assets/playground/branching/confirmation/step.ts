import { GovUKPanel, GovUKBody, GovUKButton } from '@ministryofjustice/hmpps-forge/govuk-components'
import { submit, redirect, Condition, Session, tieBreaker, step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { clearAnswers, clearDraftAnswers, saveSubmitStateToSession } from '../effects'

const panel = GovUKPanel({
  titleText: 'Visit booked',
})

const nextSteps = GovUKBody({
  text: 'Your answers have been saved to the answer store. Restart the pattern to clear them and try a different branch.',
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
  title: 'Visit booked',
  reachability: {
    // Session-based entry — survives ClearDraftAnswers unlike answer-based conditions
    entryWhen: Session('patternSubmitted.branching').match(Condition.Equals(true)),
    // Priority 200 wins over the overview entry point, so a submitted user
    // lands here instead of being sent back to the start.
    tieBreakers: [tieBreaker({ priority: 200 })],
  },
  blocks: [panel, nextSteps, restartButton],
  onSubmission: [
    submit({
      validate: false,
      onAlways: {
        // Reset everything so the user can try a different branch
        effects: [
          clearAnswers('branching'),
          clearDraftAnswers('branching'),
          saveSubmitStateToSession('branching', false),
        ],
        next: [redirect({ goto: 'overview' })],
      },
    }),
  ],
})
