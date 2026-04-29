import {
  journey,
  access,
  redirect,
  Condition,
  Request,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import { searchStep } from './steps/search/step'
import { getStartedJourney } from './sections/get-started/journey'
import { buildingJourneysJourney } from './sections/building-journeys/journey'
import { expressionsJourney } from './sections/expressions/journey'
import { componentsJourney } from './sections/components/journey'
import { packagesJourney } from './sections/packages/journey'
import { patternsGuideJourney } from './sections/patterns/journey'

export const developerGuideJourney = journey({
  code: 'forge-developer-guide',
  title: 'Forge Developer Guide',
  path: '/forge-developer-guide',
  view: {
    template: 'partials/guide-step',
  },
  reachability: {
    disableReachabilityChecks: true,
  },
  onAccess: [
    access({
      when: Request.Path().match(Condition.Equals('/forge-developer-guide')),
      next: [redirect({ goto: 'get-started/overview' })],
    }),
  ],
  children: [
    getStartedJourney,
    buildingJourneysJourney,
    expressionsJourney,
    componentsJourney,
    patternsGuideJourney,
    packagesJourney,
  ],
  steps: [searchStep],
})
