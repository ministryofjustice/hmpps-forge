import {journey, access, Request, Condition, Query} from '@ministryofjustice/hmpps-forge/core/authoring'
import { PatternEffects } from '../../effects'
import { overviewStep } from './overview/step'
import { yourNameStep } from './your-name/step'
import { yourRoleStep } from './your-role/step'
import { checkAnswersStep } from './check-answers/step'
import { confirmationStep } from './confirmation/step'

export const resumingDemoJourney = journey({
  code: 'resuming-demo',
  title: 'Resuming a partially-completed journey',
  path: '/resuming',
  reachability: {
    // When any request to this journey (including the root URL) includes
    // ?resume=true, Forge finds the furthest reachable step the user hasn't
    // completed yet and redirects there.
    resumeWhen: Query('resume').match(Condition.Equals('true')),
  },
  // Load any saved draft answers before rendering so fields are pre-filled
  // and reachability conditions can evaluate against prior progress.
  onAccess: [
    access({
      effects: [PatternEffects.LoadDraftAnswers('resuming')],
    }),
  ],
  steps: [overviewStep, yourNameStep, yourRoleStep, checkAnswersStep, confirmationStep],
})
