import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../effects'
import { content } from '../blocks/blocks'

export const itemStep = step({
  path: '/item',
  title: 'Item (Iterators)',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'References' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('item')],
    }),
  ],
  blocks: [content],
})
