import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../effects'
import { content } from '../blocks/blocks'

export const readOnlyModePatternStep = step({
  path: '/read-only-mode',
  title: 'Read-only mode',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Access and permissions' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('patterns-read-only-mode')],
    }),
  ],
  blocks: [content],
})
