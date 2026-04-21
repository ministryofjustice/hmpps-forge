import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../effects'
import { content } from '../blocks/blocks'

export const branchingPatternStep = step({
  path: '/branching',
  title: 'Branching based on an earlier answer',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Input and forms' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('patterns-branching')],
    }),
  ],
  blocks: [content],
})
