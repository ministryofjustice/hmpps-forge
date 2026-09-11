import { journey, createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'
import { overviewStep } from './overview'
import { beforeStep } from './before'
import { afterStep } from './after'

export const inlineFunctionsDemoJourney = journey({
  code: 'inline-functions-demo',
  title: 'Shaping data inline',
  path: '/inline-functions',
  steps: [overviewStep, beforeStep, afterStep],
})

export default createForgePackage({ journey: inlineFunctionsDemoJourney })
