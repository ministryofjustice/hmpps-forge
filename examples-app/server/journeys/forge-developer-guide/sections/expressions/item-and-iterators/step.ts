import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const iteratorsStep = step({
  path: '/iterators',
  title: 'Iterators',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Expressions' },
  onAccess: [loadContent('item-and-iterators')],
  blocks: [content],
})
