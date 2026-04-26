import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../../effects'
import { content } from '../../blocks/blocks'

export const transformersArrayStep = step({
  path: '/transformers-array',
  title: 'Arrays',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Transformers' },
  onAccess: [loadContent('transformers-array')],
  blocks: [content],
})
