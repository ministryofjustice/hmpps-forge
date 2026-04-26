import { journey } from '@ministryofjustice/hmpps-forge/core/authoring'
import { packagesOverviewStep } from './overview/step'
import { forgeCoreJourney } from './forge-core/journey'
import { govukComponentsJourney } from './govuk-components/journey'
import { mojComponentsJourney } from './moj-components/journey'

export const packagesJourney = journey({
  code: 'packages',
  title: 'Packages',
  path: '/packages',
  view: {
    locals: { showBackToTop: true },
  },
  steps: [packagesOverviewStep],
  children: [forgeCoreJourney, govukComponentsJourney, mojComponentsJourney],
})
