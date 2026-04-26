import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const searchAndSelectPatternStep = step({
  path: '/search-and-select',
  title: 'Search and select',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Searching and results' },
  onAccess: [loadContent('patterns-search-and-select')],
  blocks: [content],
})
