import { submit, redirect, Condition, Query } from '@ministryofjustice/hmpps-forge/core/authoring'
import { patternStep } from '../../../shared/patternStep'
import { PatternEffects } from '../../../effects'
import { fullNameField, continueButton } from './blocks'

export const fullNameStep = patternStep({
  code: 'full-name',
  path: '/full-name',
  title: 'What is your full name?',
  reachability: { entryWhen: true },
  blocks: [fullNameField, continueButton],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [PatternEffects.SaveDraftAnswers('edit-and-return')],
        next: [
          // When the user arrived via a change link, return to the summary
          redirect({
            when: Query('returnTo').match(Condition.Equals('check-answers')),
            goto: 'check-answers',
          }),
          redirect({ goto: 'email-address' }),
        ],
      },
    }),
  ],
  sourceBase: 'edit-and-return/demo/full-name',
  codeFiles: ['step.ts', 'blocks.ts'],
})
