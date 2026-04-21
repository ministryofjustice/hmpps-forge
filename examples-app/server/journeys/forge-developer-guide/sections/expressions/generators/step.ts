import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../effects'
import { content } from '../blocks/blocks'

export const generatorsStep = step({
  path: '/generators',
  title: 'Generators',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Functions' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('generators')],
    }),
  ],
  blocks: [content],
})
