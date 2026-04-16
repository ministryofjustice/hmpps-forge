import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../effects'
import { content } from '../blocks/blocks'

export const requestStep = step({
  path: '/request',
  title: 'Request',
  isEntryPoint: true,
  metadata: { navGroup: 'References' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('request')],
    }),
  ],
  blocks: [content],
})
