import { submit, redirect } from '@ministryofjustice/hmpps-forge/core/authoring'
import { patternStep } from '../../../shared/patternStep'
import { PatternEffects } from '../../../effects'
import { locationField, continueButton } from './blocks'

// Branch step for the in-person path. Only reachable when visitType is
// 'in-person', because that is the only case where visit-type's submit hook
// redirects here. Forge's reachability keeps users off this step via the URL
// if their earlier answer was different.
export const locationStep = patternStep({
  code: 'location',
  path: '/location',
  title: 'Which office would you like to visit?',
  blocks: [locationField, continueButton],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [PatternEffects.SaveDraftAnswers('branching')],
        next: [redirect({ goto: 'check-answers' })],
      },
    }),
  ],
  sourceBase: 'branching/demo/location',
  codeFiles: ['step.ts', 'blocks.ts'],
})
