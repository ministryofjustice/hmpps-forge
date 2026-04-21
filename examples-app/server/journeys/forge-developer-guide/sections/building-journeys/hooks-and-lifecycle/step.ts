import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../effects'
import { content } from '../blocks/blocks'

export const hooksAndLifecycleStep = step({
  path: '/hooks-and-lifecycle',
  title: 'Hooks and lifecycle',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Working with data' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('hooks-and-lifecycle')],
    }),
  ],
  blocks: [content],
})
