import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../../effects'
import { content } from '../../blocks/blocks'

export const fragmentStep = step({
  path: '/fragment',
  title: 'Fragment',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Components' },
  onAccess: [loadContent('fragment')],
  blocks: [content],
})
