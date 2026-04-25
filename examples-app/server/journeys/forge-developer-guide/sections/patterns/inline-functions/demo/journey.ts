import { journey } from '@ministryofjustice/hmpps-forge/core/authoring'
import { overviewStep } from './overview/step'
import { beforeStep } from './before/step'
import { afterStep } from './after/step'

export const inlineFunctionsDemoJourney = journey({
  code: 'inline-functions-demo',
  title: 'Shaping data inline',
  path: '/inline-functions',
  steps: [overviewStep, beforeStep, afterStep],
})
