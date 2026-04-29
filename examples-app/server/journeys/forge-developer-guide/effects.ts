import {
  access,
  defineEffectFunctions,
  EffectFunctionContext,
  EffectFunctionExpr,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import type GuideContentStore from '../../data/guideContentStore'
import type GuideSearch from '../../data/guideSearch'
import type FormDataStore from '../../data/formDataStore'
import type MocksApi from '../../data/mocksApi'

export interface GuideDeps {
  guideContentStore: GuideContentStore
  guideSearch: GuideSearch
  formDataStore: FormDataStore
  mocksApi: MocksApi
}

export interface GuideEffectShape {
  LoadContent: (slug: string) => EffectFunctionExpr
  SearchContent: () => EffectFunctionExpr
}

export const { effects: GuideEffects, implementations: GuideEffectsImplementations } =
  defineEffectFunctions<GuideEffectShape, GuideDeps>({
    LoadContent: (deps: GuideDeps) => async (context: EffectFunctionContext, slug: string) => {
      await deps.guideContentStore.load()

      const entry = deps.guideContentStore.get(slug)

      if (entry) {
        context.setData('content', entry.markdown)
        context.setData('headings', deps.guideContentStore.getHeadings(slug))
        context.setData('pageTitle', entry.title)
      }
    },

    SearchContent: (deps: GuideDeps) => async (context: EffectFunctionContext) => {
      const queryParam = context.getQueryParam('q')
      const query = typeof queryParam === 'string' ? queryParam : ''

      if (query) {
        const results = await deps.guideSearch.search(query)
        context.setData('searchResults', results)
        context.setData('searchQuery', query)
      } else {
        context.setData('searchResults', [])
        context.setData('searchQuery', '')
      }
    },
  })

export function loadContent(slug: string) {
  return access({
    effects: [GuideEffects.LoadContent(slug)],
  })
}
