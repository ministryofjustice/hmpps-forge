import { journey } from '@ministryofjustice/hmpps-forge/core/authoring'
import { searchStep } from './steps/search/step'
import { getStartedJourney } from './sections/get-started/journey'
import { buildingJourneysJourney } from './sections/building-journeys/journey'
import { expressionsJourney } from './sections/expressions/journey'
import { componentsJourney } from './sections/components/journey'

export const developerGuideJourney = journey({
  code: 'forge-developer-guide',
  title: 'Forge Developer Guide',
  path: '/forge-developer-guide',
  view: {
    template: 'partials/guide-step',
  },
  children: [getStartedJourney, buildingJourneysJourney, expressionsJourney, componentsJourney],
  steps: [searchStep],
})
