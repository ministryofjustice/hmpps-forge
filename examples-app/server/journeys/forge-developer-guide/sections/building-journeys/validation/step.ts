import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../effects'
import { content } from '../blocks/blocks'

export const validationStep = step({
  path: '/validation',
  title: 'Validation',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Working with data' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('validation')],
    }),
  ],
  blocks: [content],
})
