import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../effects'
import { content } from '../blocks/blocks'

export const resumingPatternStep = step({
  path: '/resuming',
  title: 'Resuming a partially-completed journey',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Entry and routing' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('patterns-resuming')],
    }),
  ],
  blocks: [content],
})
