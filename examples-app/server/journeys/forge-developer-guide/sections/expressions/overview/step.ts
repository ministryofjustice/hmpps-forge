import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const expressionsOverviewStep = step({
  path: '/overview',
  title: 'Expressions',
  reachability: { entryWhen: true },
  metadata: { hiddenFromNav: true },
  onAccess: [loadContent('expressions')],
  blocks: [content],
})
