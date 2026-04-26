import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const literalStep = step({
  path: '/literal',
  title: 'Literal',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Expressions' },
  onAccess: [loadContent('literal')],
  blocks: [content],
})
