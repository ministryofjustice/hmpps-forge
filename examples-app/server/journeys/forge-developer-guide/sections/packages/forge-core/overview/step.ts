import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../../effects'
import { content } from '../../blocks/blocks'

export const forgeCoreOverviewStep = step({
  path: '/overview',
  title: 'Forge Core',
  reachability: { entryWhen: true },
  metadata: { hiddenFromNav: true },
  onAccess: [loadContent('forge-core')],
  blocks: [content],
})
