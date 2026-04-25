import { submit, redirect, Condition, Query } from '@ministryofjustice/hmpps-forge/core/authoring'
import { patternStep } from '../../../shared/patternStep'
import { PatternEffects } from '../../../effects'
import { contactPreferenceField, continueButton } from './blocks'

export const contactPreferenceStep = patternStep({
  code: 'contact-preference',
  path: '/contact-preference',
  title: 'How would you prefer to be contacted?',
  reachability: { entryWhen: true },
  blocks: [contactPreferenceField, continueButton],
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
          redirect({ goto: 'check-answers' }),
        ],
      },
    }),
  ],
  sourceBase: 'edit-and-return/demo/contact-preference',
  codeFiles: ['step.ts', 'blocks.ts'],
})
