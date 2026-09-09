import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../../effects'
import { content } from '../../blocks/blocks'

export const forgeBrowserOverviewStep = step({
  path: '/overview',
  title: 'Browser Adapter',
  reachability: { entryWhen: true },
  metadata: { hiddenFromNav: true },
  onAccess: [loadContent('forge-browser')],
  blocks: [content],
})
