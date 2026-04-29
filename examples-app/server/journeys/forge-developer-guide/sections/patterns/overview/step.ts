import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const patternsOverviewStep = step({
  path: '/overview',
  title: 'Patterns',
  reachability: { entryWhen: true },
  metadata: { hiddenFromNav: true },
  onAccess: [loadContent('patterns')],
  blocks: [content],
})
