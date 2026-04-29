import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const combinatorsStep = step({
  path: '/combinators',
  title: 'Combinators',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Expressions' },
  onAccess: [loadContent('combinators')],
  blocks: [content],
})
