import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../effects'
import { content } from '../blocks/blocks'

export const whyUseForgeStep = step({
  path: '/why-use-forge',
  title: 'Why use Forge',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Setup guides' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('why-use-forge')],
    }),
  ],
  blocks: [content],
})
