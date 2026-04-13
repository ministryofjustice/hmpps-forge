import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../effects'
import { content } from '../blocks/blocks'

export const loadingSavingAndRedirectingStep = step({
  path: '/loading-saving-and-redirecting',
  title: 'Loading, saving and redirecting',
  isEntryPoint: true,
  metadata: { navGroup: 'Working with data' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('loading-saving-and-redirecting')],
    }),
  ],
  blocks: [content],
})
