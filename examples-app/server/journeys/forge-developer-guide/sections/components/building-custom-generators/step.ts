import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../effects'
import { content } from '../blocks/blocks'

export const buildingCustomGeneratorsStep = step({
  path: '/custom-generators',
  title: 'Custom generators',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Functions' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('building-custom-generators')],
    }),
  ],
  blocks: [content],
})
