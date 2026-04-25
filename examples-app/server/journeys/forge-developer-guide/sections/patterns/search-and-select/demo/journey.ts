import { journey, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { PatternEffects } from '../../effects'
import { overviewStep } from './overview/step'
import { searchStep } from './search/step'
import { logStep } from './log/step'

export const searchAndSelectDemoJourney = journey({
  code: 'search-and-select-demo',
  title: 'Search and select',
  path: '/search-and-select',
  onAccess: [
    access({
      effects: [PatternEffects.LoadDraftAnswers('search-and-select')],
    }),
  ],
  steps: [overviewStep, searchStep, logStep],
})
