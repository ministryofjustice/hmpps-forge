import { journey, access, createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadDraftAnswers } from './effects'
import type { PatternDependencies } from './effects'
import { StationService } from './StationService'
import { overviewStep } from './overview'
import { searchStep } from './search'
import { stationStep } from './station'

export const searchAndSelectDemoJourney = journey({
  code: 'search-and-select-demo',
  title: 'Search and select',
  path: '/search-and-select',
  onAccess: [
    access({
      effects: [loadDraftAnswers()],
    }),
  ],
  steps: [overviewStep, searchStep, stationStep],
})

export const dependencies: PatternDependencies = { stationService: new StationService() }

export default createForgePackage<PatternDependencies>({ journey: searchAndSelectDemoJourney })
