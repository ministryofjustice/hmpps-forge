import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../effects'
import { content } from '../blocks/blocks'

export const getInTouchStep = step({
  path: '/get-in-touch',
  title: 'Get in touch',
  isEntryPoint: true,
  metadata: { navGroup: 'Resources' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('get-in-touch')],
    }),
  ],
  blocks: [content],
})
