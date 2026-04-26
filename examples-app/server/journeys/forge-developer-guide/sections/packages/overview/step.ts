import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const packagesOverviewStep = step({
  path: '/overview',
  title: 'Packages',
  reachability: { entryWhen: true },
  metadata: { hiddenFromNav: true },
  onAccess: [loadContent('packages')],
  blocks: [content],
})
