import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../../effects'
import { content } from './blocks'

export const interruptionCardStep = step({
  path: '/interruption-card',
  title: 'Interruption Card',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Components' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('moj-interruption-card')],
    }),
  ],
  blocks: [content],
})
