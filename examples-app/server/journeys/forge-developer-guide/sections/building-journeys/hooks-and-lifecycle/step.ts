import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const hooksAndLifecycleStep = step({
  path: '/hooks-and-lifecycle',
  title: 'Hooks and lifecycle',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Working with data' },
  onAccess: [loadContent('hooks-and-lifecycle')],
  blocks: [content],
})
