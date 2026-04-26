import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const inlineFunctionsStep = step({
  path: '/inline-functions',
  title: 'Inlining functions',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Functions' },
  onAccess: [loadContent('inline-functions')],
  blocks: [content],
})
