import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../effects'
import { content } from '../blocks/blocks'

export const inlineFunctionsStep = step({
  path: '/inline-functions',
  title: 'Inlining functions',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Functions' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('inline-functions')],
    }),
  ],
  blocks: [content],
})
