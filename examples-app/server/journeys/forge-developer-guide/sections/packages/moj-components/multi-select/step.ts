import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../../effects'
import { content } from './blocks'

export const multiSelectStep = step({
  path: '/multi-select',
  title: 'Multi Select',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Components' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('moj-multi-select')],
    }),
  ],
  blocks: [content],
})
