import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const queryStep = step({
  path: '/query',
  title: 'Query',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'References' },
  onAccess: [loadContent('query')],
  blocks: [content],
})
