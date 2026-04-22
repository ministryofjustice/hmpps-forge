import { journey, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { PatternEffects } from '../../effects'
import { overviewStep } from './overview/step'
import { drawStep } from './draw/step'

export const loadReferenceDataDemoJourney = journey({
  code: 'load-reference-data-demo',
  title: 'Load reference data on access',
  path: '/load-reference-data',
  onAccess: [
    access({
      effects: [PatternEffects.DrawLotteryNumbers()],
    }),
  ],
  steps: [overviewStep, drawStep],
})
