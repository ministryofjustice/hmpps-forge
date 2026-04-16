import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../effects'
import { content } from '../blocks/blocks'

export const buildingCustomTransformersStep = step({
  path: '/custom-transformers',
  title: 'Custom transformers',
  isEntryPoint: true,
  metadata: { navGroup: 'Functions' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('building-custom-transformers')],
    }),
  ],
  blocks: [content],
})
