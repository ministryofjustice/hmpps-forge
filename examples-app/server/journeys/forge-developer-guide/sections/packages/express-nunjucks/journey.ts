import { journey } from '@ministryofjustice/hmpps-forge/core/authoring'
import { expressNunjucksOverviewStep } from './overview/step'
import { expressNunjucksRequestStateStep } from './request-state/step'
import { expressNunjucksRenderingStep } from './rendering/step'
import { expressNunjucksBuildingComponentsStep } from './building-components/step'
import { expressNunjucksGeneratorsStep } from './nunjucks-generators/step'

export const expressNunjucksJourney = journey({
  code: 'express-nunjucks',
  title: 'Express-Nunjucks Adapter',
  path: '/express-nunjucks',
  metadata: { navGroup: 'Frameworks' },
  view: {
    locals: { showBackToTop: true },
  },
  steps: [
    expressNunjucksOverviewStep,
    expressNunjucksRequestStateStep,
    expressNunjucksRenderingStep,
    expressNunjucksBuildingComponentsStep,
    expressNunjucksGeneratorsStep,
  ],
})
