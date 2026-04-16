import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../effects'
import { content } from '../blocks/blocks'

export const conditionsStep = step({
  path: '/conditions',
  title: 'Conditions',
  isEntryPoint: true,
  metadata: { navGroup: 'Functions' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('conditions')],
    }),
  ],
  blocks: [content],
})
