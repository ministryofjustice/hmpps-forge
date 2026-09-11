import { journey, access, createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'
import { drawLotteryNumbers, type PatternDependencies } from './effects'
import { LotteryService } from './LotteryService'
import { overviewStep } from './overview'
import { drawStep } from './draw'

export const loadReferenceDataDemoJourney = journey({
  code: 'load-reference-data-demo',
  title: 'Load reference data on access',
  path: '/load-reference-data',
  onAccess: [
    access({
      effects: [drawLotteryNumbers()],
    }),
  ],
  steps: [overviewStep, drawStep],
})

export const dependencies: PatternDependencies = { lotteryService: new LotteryService() }

export default createForgePackage<PatternDependencies>({ journey: loadReferenceDataDemoJourney })
