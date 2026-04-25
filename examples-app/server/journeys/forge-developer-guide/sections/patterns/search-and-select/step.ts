import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../effects'
import { content } from '../blocks/blocks'

export const searchAndSelectPatternStep = step({
  path: '/search-and-select',
  title: 'Search and select',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Searching and results' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('patterns-search-and-select')],
    }),
  ],
  blocks: [content],
})
