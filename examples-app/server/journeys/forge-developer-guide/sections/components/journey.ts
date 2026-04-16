import { journey } from '@ministryofjustice/hmpps-forge/core/authoring'
import { buildingCustomTransformersStep } from './building-custom-transformers/step'
import { buildingCustomGeneratorsStep } from './building-custom-generators/step'
import { buildingCustomConditionsStep } from './building-custom-conditions/step'
import { buildingCustomEffectsStep } from './building-custom-effects/step'

export const componentsJourney = journey({
  code: 'building-functions-and-components',
  title: 'Building functions & components',
  path: '/building-functions-and-components',
  view: {
    locals: { showBackToTop: true },
  },
  steps: [
    buildingCustomTransformersStep,
    buildingCustomGeneratorsStep,
    buildingCustomConditionsStep,
    buildingCustomEffectsStep,
  ],
})
