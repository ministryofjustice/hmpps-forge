import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../effects'
import { content } from '../blocks/blocks'

export const sessionStep = step({
  path: '/session',
  title: 'Session',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'References' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('session')],
    }),
  ],
  blocks: [content],
})
