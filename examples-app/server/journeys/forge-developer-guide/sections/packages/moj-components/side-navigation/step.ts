import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../../effects'
import { content } from './blocks'

export const sideNavigationStep = step({
  path: '/side-navigation',
  title: 'Side Navigation',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Components' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('moj-side-navigation')],
    }),
  ],
  blocks: [content],
})
