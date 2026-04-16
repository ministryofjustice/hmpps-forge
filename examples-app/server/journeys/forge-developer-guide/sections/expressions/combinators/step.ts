import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../effects'
import { content } from '../blocks/blocks'

export const combinatorsStep = step({
  path: '/combinators',
  title: 'Combinators',
  isEntryPoint: true,
  metadata: { navGroup: 'Expressions' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('combinators')],
    }),
  ],
  blocks: [content],
})
