import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../effects'
import { content } from '../blocks/blocks'

export const loopStep = step({
  path: '/loop',
  title: 'Loop (Iterators)',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'References' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('loop')],
    }),
  ],
  blocks: [content],
})
