import { submit, access, redirect } from '@ministryofjustice/hmpps-forge/core/authoring'
import { patternStep } from '../../../shared/patternStep'
import { PatternEffects } from '../../../effects'
import { heading, intro, goalActions, continueButton } from './blocks'

export const managePlanStep = patternStep({
  code: 'manage-plan',
  path: '/manage-plan',
  title: 'Add actions to goals',
  reachability: { entryWhen: true },
  blocks: [heading, intro, goalActions, continueButton],
  onAccess: [
    access({
      effects: [PatternEffects.InitializePlanActions()],
    }),
  ],
  onSubmission: [
    submit({
      validate: false,
      onAlways: {
        effects: [PatternEffects.SavePlanActions()],
        next: [redirect({ goto: 'agree-plan' })],
      },
    }),
  ],
  sourceBase: 'collection-validation/demo/manage-plan',
  codeFiles: ['step.ts', 'blocks.ts'],
})
