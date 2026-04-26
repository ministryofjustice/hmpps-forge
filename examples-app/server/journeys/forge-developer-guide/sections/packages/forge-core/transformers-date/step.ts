import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../../effects'
import { content } from '../../blocks/blocks'

export const transformersDateStep = step({
  path: '/transformers-date',
  title: 'Dates',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Transformers' },
  onAccess: [loadContent('transformers-date')],
  blocks: [content],
})
