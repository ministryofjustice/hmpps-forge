import { effect } from '@ministryofjustice/hmpps-forge/core/authoring'
import type { StationService } from './StationService'
import type { EffectFunctionContext } from '@ministryofjustice/hmpps-forge/core/authoring'

export type PatternDependencies = {
  stationService: Pick<StationService, 'search' | 'get'>
}

type PatternSession = {
  draftAnswers?: Record<string, unknown>
}

type PatternEffectContext = EffectFunctionContext<
  Record<string, unknown>,
  Record<string, unknown>,
  PatternSession
>

/** Copies previously stored draft answers for this pattern into the form context on access. */
export const loadDraftAnswers = effect({
  name: 'LoadDraftAnswers',
  factory: () => (context: PatternEffectContext) => {
    const stored = context.getSession()?.draftAnswers

    if (!stored) {
      return
    }

    Object.entries(stored).forEach(([code, value]) => {
      if (!context.hasAnswer(code)) {
        context.setAnswer(code, value)
      }
    })
  },
})

/** Persists the current answers into the session as a draft, kept separately from committed answers. */
export const saveDraftAnswers = effect({
  name: 'SaveDraftAnswers',
  factory: () => (context: PatternEffectContext) => {
    const session = context.getSession()

    if (!session) {
      return
    }

    session.draftAnswers = {
      ...session.draftAnswers,
      ...context.getAllAnswers(),
    }
  },
})

/** Searches the injected directory after restoring the submitted query. */
export const searchStations = effect({
  name: 'SearchStations',
  factory: ({ stationService }: PatternDependencies) => async (context: PatternEffectContext) => {
    const query = context.getAnswer('searchQuery')

    if (typeof query !== 'string' || !query.trim()) {
      context.setData('searchResults', [])

      return
    }

    const stations = await stationService.search(query)

    context.setData('searchResults', stations.map(station => ({ ...station, href: `station/${station.index}` })))
    context.setData('hasSearched', true)
  },
})

/** Loads the selected station through its route parameter. */
export const loadStation = effect({
  name: 'LoadStation',
  factory: ({ stationService }: PatternDependencies) => async (context: PatternEffectContext) => {
    const parameter = context.getRequestParam('index')
    const index = Number(parameter)

    if (parameter === undefined || !Number.isInteger(index) || index < 0) {
      return
    }

    const station = await stationService.get(index)

    if (!station) {
      return
    }

    context.setData('stationName', station.name)
    context.setData('stationLines', station.lines)
    context.setData('stationZone', station.zone)
    context.setData('stationOpened', station.opened)
    context.setData('stationDescription', station.description)
  },
})
