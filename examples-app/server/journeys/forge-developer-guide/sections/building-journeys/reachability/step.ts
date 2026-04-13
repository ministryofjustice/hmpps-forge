import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../effects'
import { content } from '../blocks/blocks'

export const reachabilityStep = step({
  path: '/reachability',
  title: 'Reachability',
  isEntryPoint: true,
  metadata: { navGroup: 'Routing, reachability and navigation' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('reachability')],
    }),
  ],
  blocks: [content],
})
