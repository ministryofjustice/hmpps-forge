import {
  access,
  EffectFunctionContext,
  EffectRegistry,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import type GuideContentStore from '../../data/guideContentStore'

export interface GuideV2Deps {
  guideV2ContentStore: GuideContentStore
}

interface GuidePageLink {
  tag: string
  quadrant: string
  title: string
  href: string
  description?: string
}

const RELATED_KINDS: Record<string, { tag: string; quadrant: string }> = {
  concept: { tag: 'Concept', quadrant: 'concepts' },
  'how-to': { tag: 'How-to', quadrant: 'how-to-guides' },
  reference: { tag: 'Reference', quadrant: 'reference' },
  tutorial: { tag: 'Tutorial', quadrant: 'learn' },
}

function resolvePageLinks(
  store: GuideContentStore,
  pages: Record<string, string>,
  withDescription: boolean,
): GuidePageLink[] {
  return Object.entries(pages).flatMap(([kind, slugs]) => {
    const descriptor = RELATED_KINDS[kind]

    if (!descriptor) {
      return []
    }

    return slugs
      .split(',')
      .map(slug => slug.trim())
      .filter(Boolean)
      .flatMap(slug => {
        const entry = store.get(slug)

        if (!entry) {
          return []
        }

        return [
          {
            tag: descriptor.tag,
            quadrant: descriptor.quadrant,
            title: entry.title,
            href: `/forge-guide-v2/${entry.path}`,
            ...(withDescription && entry.description ? { description: entry.description } : {}),
          },
        ]
      })
  })
}

export const guideV2EffectRegistry = new EffectRegistry<GuideV2Deps>()

export const GuideV2Effects = {
  LoadContent: guideV2EffectRegistry.register(
    'LoadContent',
    deps =>
      async (
        context: EffectFunctionContext,
        slug: string,
        related: Record<string, string>,
        next: Record<string, string>,
      ) => {
        await deps.guideV2ContentStore.load()

        const entry = deps.guideV2ContentStore.get(slug)

        if (entry) {
          context.setData('content', entry.markdown)
          context.setData('headings', deps.guideV2ContentStore.getHeadings(slug))
          context.setData('pageTitle', entry.title)
        }

        if (Object.keys(related).length > 0) {
          context.setData(
            'relatedPages',
            resolvePageLinks(deps.guideV2ContentStore, related, false),
          )
        }

        if (Object.keys(next).length > 0) {
          context.setData('nextPages', resolvePageLinks(deps.guideV2ContentStore, next, true))
        }
      },
  ),
}

export function loadContentV2(
  slug: string,
  related?: Record<string, string>,
  next?: Record<string, string>,
) {
  return access({
    effects: [GuideV2Effects.LoadContent(slug, related ?? {}, next ?? {})],
  })
}
