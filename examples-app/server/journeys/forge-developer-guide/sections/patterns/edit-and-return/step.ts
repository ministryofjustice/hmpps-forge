import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../effects'
import { content } from '../blocks/blocks'

export const editAndReturnPatternStep = step({
  path: '/edit-and-return',
  title: 'Edit and return',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Entry and routing' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('patterns-edit-and-return')],
    }),
  ],
  blocks: [content],
})
