import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const paginationPatternStep = step({
  path: '/pagination',
  title: 'Pagination',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Searching and results' },
  onAccess: [loadContent('patterns-pagination')],
  blocks: [content],
})
