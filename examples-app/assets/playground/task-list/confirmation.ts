import { GovUKPanel, GovUKBody, GovUKButton } from '@ministryofjustice/hmpps-forge/govuk-components'
import {
  submit,
  redirect,
  Post,
  Condition,
  Data,
  tieBreaker,
  step,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import { clearAnswers, clearDraftAnswers } from './effects'

const panel = GovUKPanel({
  titleText: 'Application submitted',
  text: 'Your visit request has been sent.',
})

const whatNext = GovUKBody({
  text: 'We will review your application and send a confirmation email within 3 working days.',
})

// Posts action='restart' to trigger the onSubmission handler that resets the journey
const restartButton = GovUKButton({
  text: 'Start a new application',
  name: 'action',
  value: 'restart',
  classes: 'govuk-button--secondary',
})

export const confirmationStep = step({
  code: 'confirmation',
  path: '/confirmation',
  title: 'Application submitted',
  reachability: {
    // A saved record keeps confirmation reachable after drafts are cleared
    entryWhen: Data('savedAnswers').match(Condition.IsRequired()),
    // Win over the tasks entrypoint, so that if user opens journey again (but hasnt reset),
    // they are taken straight to the confirmation page.
    tieBreakers: [tieBreaker({ priority: 100 })],
  },
  blocks: [panel, whatNext, restartButton],
  onSubmission: [
    submit({
      when: Post('action').match(Condition.Equals('restart')),
      validate: false,
      onAlways: {
        effects: [
          // Reset everything so the user can start fresh
          clearAnswers(),
          clearDraftAnswers(),
        ],
        next: [redirect({ goto: 'overview' })],
      },
    }),
  ],
})
