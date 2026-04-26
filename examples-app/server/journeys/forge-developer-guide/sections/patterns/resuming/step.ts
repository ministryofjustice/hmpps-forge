import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const resumingPatternStep = step({
  path: '/resuming',
  title: 'Resuming a partially-completed journey',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Entry and routing' },
  onAccess: [loadContent('patterns-resuming')],
  blocks: [content],
})
