import {
  defineEffectFunctions,
  EffectFunctionContext,
  EffectFunctionExpr,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import type GuideContentStore from '../../data/guideContentStore'
import type GuideSearch from '../../data/guideSearch'

export interface GuideDeps {
  guideContentStore: GuideContentStore
  guideSearch: GuideSearch
}

export interface GuideEffectShape {
  LoadContent: (slug: string) => EffectFunctionExpr
  SearchContent: () => EffectFunctionExpr
}

export const { effects: GuideEffects, implementations: GuideEffectsImplementations } =
  defineEffectFunctions<GuideEffectShape, GuideDeps>({
    LoadContent: deps => async (context: EffectFunctionContext, slug: string) => {
      await deps.guideContentStore.load()

      const markdown = deps.guideContentStore.getMarkdown(slug)

      if (markdown) {
        context.setData('content', markdown)
        context.setData('headings', deps.guideContentStore.getHeadings(slug))
      }
    },

    SearchContent: deps => async (context: EffectFunctionContext) => {
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
