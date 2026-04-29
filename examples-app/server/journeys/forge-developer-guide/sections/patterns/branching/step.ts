import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const branchingPatternStep = step({
  path: '/branching',
  title: 'Branching based on an earlier answer',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Input and forms' },
  onAccess: [loadContent('patterns-branching')],
  blocks: [content],
})
