import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const routingAndEntryPointsStep = step({
  path: '/routing-and-entry-points',
  title: 'Routing and entry points',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Routing, reachability and navigation' },
  onAccess: [loadContent('routing-and-entry-points')],
  blocks: [content],
})
