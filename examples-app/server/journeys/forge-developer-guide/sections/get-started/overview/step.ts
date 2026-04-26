import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const getStartedOverviewStep = step({
  path: '/overview',
  title: 'Get started',
  reachability: { entryWhen: true },
  metadata: { hiddenFromNav: true },
  onAccess: [loadContent('get-started')],
  blocks: [content],
})
