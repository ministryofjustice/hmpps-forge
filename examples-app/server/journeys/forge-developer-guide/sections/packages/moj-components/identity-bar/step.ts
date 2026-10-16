import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../../effects'
import { content } from './blocks'

export const identityBarStep = step({
  path: '/identity-bar',
  title: 'Identity Bar',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Components' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('moj-identity-bar')],
    }),
  ],
  blocks: [content],
})
