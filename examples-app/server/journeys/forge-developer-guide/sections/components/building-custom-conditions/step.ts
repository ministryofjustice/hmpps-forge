import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../effects'
import { content } from '../blocks/blocks'

export const buildingCustomConditionsStep = step({
  path: '/custom-conditions',
  title: 'Custom conditions',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Functions' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('building-custom-conditions')],
    }),
  ],
  blocks: [content],
})
