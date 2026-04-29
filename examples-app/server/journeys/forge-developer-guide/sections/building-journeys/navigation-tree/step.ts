import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const navigationTreeStep = step({
  path: '/navigation-tree',
  title: 'The navigation tree',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Routing, reachability and navigation' },
  onAccess: [loadContent('navigation-tree')],
  blocks: [content],
})
