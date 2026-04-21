import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../effects'
import { content } from '../blocks/blocks'

export const literalStep = step({
  path: '/literal',
  title: 'Literal',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Expressions' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('literal')],
    }),
  ],
  blocks: [content],
})
