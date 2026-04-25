import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../effects'
import { content } from '../blocks/blocks'

export const paginationPatternStep = step({
  path: '/pagination',
  title: 'Pagination',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Searching and results' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('patterns-pagination')],
    }),
  ],
  blocks: [content],
})
