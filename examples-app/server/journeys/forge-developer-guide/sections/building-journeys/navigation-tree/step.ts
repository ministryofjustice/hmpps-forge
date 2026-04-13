import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../effects'
import { content } from '../blocks/blocks'

export const navigationTreeStep = step({
  path: '/navigation-tree',
  title: 'The navigation tree',
  isEntryPoint: true,
  metadata: { navGroup: 'Routing, reachability and navigation' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('navigation-tree')],
    }),
  ],
  blocks: [content],
})
