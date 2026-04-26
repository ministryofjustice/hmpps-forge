import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../../effects'
import { content } from '../../blocks/blocks'

export const transformersObjectStep = step({
  path: '/transformers-object',
  title: 'Objects',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Transformers' },
  onAccess: [loadContent('transformers-object')],
  blocks: [content],
})
