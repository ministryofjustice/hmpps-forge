import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const formatStep = step({
  path: '/format',
  title: 'Format',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Expressions' },
  onAccess: [loadContent('format')],
  blocks: [content],
})
