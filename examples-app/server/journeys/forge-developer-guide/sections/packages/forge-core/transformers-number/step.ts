import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../../effects'
import { content } from '../../blocks/blocks'

export const transformersNumberStep = step({
  path: '/transformers-number',
  title: 'Numbers',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Transformers' },
  onAccess: [loadContent('transformers-number')],
  blocks: [content],
})
