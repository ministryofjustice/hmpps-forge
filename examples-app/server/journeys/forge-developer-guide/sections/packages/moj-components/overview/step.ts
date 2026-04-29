import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../../effects'
import { content } from '../../blocks/blocks'

export const mojComponentsOverviewStep = step({
  path: '/overview',
  title: 'MOJ Components',
  reachability: { entryWhen: true },
  metadata: { hiddenFromNav: true },
  onAccess: [loadContent('moj-components-package')],
  blocks: [content],
})
