import { submit, redirect } from '@ministryofjustice/hmpps-forge/core/authoring'
import { patternStep } from '../../../shared/patternStep'
import { PatternEffects } from '../../../effects'
import { videoEmailField, continueButton } from './blocks'

// Branch step for the video path — only reachable when visitType is 'video'.
// All branches converge on check-answers after collecting their details.
export const videoEmailStep = patternStep({
  code: 'video-email',
  path: '/video-email',
  title: 'What email should we send the invite to?',
  blocks: [videoEmailField, continueButton],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [PatternEffects.SaveDraftAnswers('branching')],
        next: [redirect({ goto: 'check-answers' })],
      },
    }),
  ],
  sourceBase: 'branching/demo/video-email',
  codeFiles: ['step.ts', 'blocks.ts'],
})
