import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../../effects'
import { content } from '../../blocks/blocks'

export const collectionBlockStep = step({
  path: '/collection-block',
  title: 'CollectionBlock',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Components' },
  onAccess: [loadContent('collection-block')],
  blocks: [content],
})
