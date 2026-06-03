import { submit, redirect } from '@ministryofjustice/hmpps-forge/core/authoring'
import { patternStep } from '../../../shared/patternStep'
import { PatternEffects } from '../../../effects'
import { heading, intro, agreePlanField, buttonGroup } from './blocks'

export const agreePlanStep = patternStep({
  code: 'agree-plan',
  path: '/agree-plan',
  title: 'Agree sentence plan',
  reachability: { entryWhen: true },
  blocks: [heading, intro, agreePlanField, buttonGroup],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [
          PatternEffects.SaveDraftAnswers('collection-validation'),
          PatternEffects.SaveSubmitStateToSession('collection-validation', true),
        ],
        next: [redirect({ goto: 'confirmation' })],
      },
    }),
  ],
  sourceBase: 'collection-validation/demo/agree-plan',
  codeFiles: ['step.ts', 'blocks.ts'],
})
