import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../effects'
import { content } from '../blocks/blocks'

export const postStep = step({
  path: '/post',
  title: 'Post',
  isEntryPoint: true,
  metadata: { navGroup: 'References' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('post')],
    }),
  ],
  blocks: [content],
})
