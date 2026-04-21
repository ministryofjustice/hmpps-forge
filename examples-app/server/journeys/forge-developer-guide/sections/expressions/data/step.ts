import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../effects'
import { content } from '../blocks/blocks'

export const dataStep = step({
  path: '/data',
  title: 'Data',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'References' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('data')],
    }),
  ],
  blocks: [content],
})
