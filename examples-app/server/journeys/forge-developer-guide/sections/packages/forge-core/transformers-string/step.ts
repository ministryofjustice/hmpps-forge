import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../../effects'
import { content } from '../../blocks/blocks'

export const transformersStringStep = step({
  path: '/transformers-string',
  title: 'Strings',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Transformers' },
  onAccess: [loadContent('transformers-string')],
  blocks: [content],
})
