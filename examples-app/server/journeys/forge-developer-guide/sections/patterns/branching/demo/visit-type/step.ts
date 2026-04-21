import { submit, redirect, Answer, Condition } from '@ministryofjustice/hmpps-forge/core/authoring'
import { patternStep } from '../../../shared/patternStep'
import { PatternEffects } from '../../../effects'
import { visitTypeField, continueButton } from './blocks'

// The branching happens here. After saving, the next[] array is evaluated in
// order: the first redirect whose `when` matches wins. The final redirect has
// no `when`, so it acts as a fallback. Only one of them will fire per submit.
export const visitTypeStep = patternStep({
  code: 'visit-type',
  path: '/visit-type',
  title: 'How would you like to meet?',
  reachability: { entryWhen: true },
  blocks: [visitTypeField, continueButton],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [PatternEffects.SaveDraftAnswers('branching')],
        next: [
          redirect({
            when: Answer('visitType').match(Condition.Equals('in-person')),
            goto: 'location',
          }),
          redirect({
            when: Answer('visitType').match(Condition.Equals('video')),
            goto: 'video-email',
          }),
          redirect({ goto: 'phone-number' }),
        ],
      },
    }),
  ],
  sourceBase: 'branching/demo/visit-type',
  codeFiles: ['step.ts', 'blocks.ts'],
})
