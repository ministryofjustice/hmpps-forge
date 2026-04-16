import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../effects'
import { content } from '../blocks/blocks'

export const buildingCustomEffectsStep = step({
  path: '/custom-effects',
  title: 'Custom effects',
  isEntryPoint: true,
  metadata: { navGroup: 'Functions' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('building-custom-effects')],
    }),
  ],
  blocks: [content],
})
