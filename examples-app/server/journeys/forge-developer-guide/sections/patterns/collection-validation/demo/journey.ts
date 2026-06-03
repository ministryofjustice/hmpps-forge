import { journey, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { PatternEffects } from '../../effects'
import { overviewStep } from './overview/step'
import { agreePlanStep } from './agree-plan/step'
import { managePlanStep } from './manage-plan/step'
import { confirmationStep } from './confirmation/step'

export const collectionValidationDemoJourney = journey({
  code: 'collection-validation-demo',
  title: 'Validating collections with iterators',
  path: '/collection-validation',
  onAccess: [
    access({
      effects: [PatternEffects.LoadPlanGoals()],
    }),
  ],
  steps: [overviewStep, managePlanStep, agreePlanStep, confirmationStep],
})
