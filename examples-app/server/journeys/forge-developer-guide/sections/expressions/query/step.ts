import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../effects'
import { content } from '../blocks/blocks'

export const queryStep = step({
  path: '/query',
  title: 'Query',
  isEntryPoint: true,
  metadata: { navGroup: 'References' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('query')],
    }),
  ],
  blocks: [content],
})
