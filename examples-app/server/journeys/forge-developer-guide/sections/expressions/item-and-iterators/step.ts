import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../effects'
import { content } from '../blocks/blocks'

export const iteratorsStep = step({
  path: '/iterators',
  title: 'Iterators',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Expressions' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('item-and-iterators')],
    }),
  ],
  blocks: [content],
})
