import { submit, redirect, Condition, Query } from '@ministryofjustice/hmpps-forge/core/authoring'
import { patternStep } from '../../../shared/patternStep'
import { PatternEffects } from '../../../effects'
import { emailField, continueButton } from './blocks'

export const emailAddressStep = patternStep({
  code: 'email-address',
  path: '/email-address',
  title: 'What is your email address?',
  reachability: { entryWhen: true },
  blocks: [emailField, continueButton],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [PatternEffects.SaveDraftAnswers('edit-and-return')],
        next: [
          redirect({
            when: Query('returnTo').match(Condition.Equals('check-answers')),
            goto: 'check-answers',
          }),
          redirect({ goto: 'contact-preference' }),
        ],
      },
    }),
  ],
  sourceBase: 'edit-and-return/demo/email-address',
  codeFiles: ['step.ts', 'blocks.ts'],
})
