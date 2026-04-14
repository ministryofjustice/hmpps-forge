import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../effects'
import { content } from '../blocks/blocks'

export const installingForgeStep = step({
  path: '/installing-forge',
  title: 'Installing Forge',
  isEntryPoint: true,
  metadata: { navGroup: 'Setup guides' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('installing-forge')],
    }),
  ],
  blocks: [content],
})
