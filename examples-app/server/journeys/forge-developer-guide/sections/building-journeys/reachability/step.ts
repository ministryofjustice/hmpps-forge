import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const reachabilityStep = step({
  path: '/reachability',
  title: 'Reachability',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Routing, reachability and navigation' },
  onAccess: [loadContent('reachability')],
  blocks: [content],
})
