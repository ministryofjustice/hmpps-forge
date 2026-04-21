import { journey, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { PatternEffects } from '../../effects'
import { overviewStep } from './overview/step'
import { yourNameStep } from './your-name/step'
import { yourRoleStep } from './your-role/step'
import { checkAnswersStep } from './check-answers/step'
import { confirmationStep } from './confirmation/step'

// The demo journey loads any draft answers stored in the session on every access so
// the user can jump between steps without losing their progress.
export const singleQuestionPerPageDemoJourney = journey({
  code: 'single-question-per-page-demo',
  title: 'Single question per page',
  path: '/single-question-per-page',
  onAccess: [
    access({
      effects: [PatternEffects.LoadDraftAnswers('single-question-per-page')],
    }),
  ],
  steps: [overviewStep, yourNameStep, yourRoleStep, checkAnswersStep, confirmationStep],
})
