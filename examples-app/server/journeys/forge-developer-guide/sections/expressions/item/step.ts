import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const itemStep = step({
  path: '/item',
  title: 'Item (Iterators)',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'References' },
  onAccess: [loadContent('item')],
  blocks: [content],
})
