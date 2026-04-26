import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const inlineFunctionsPatternStep = step({
  path: '/inline-functions',
  title: 'Shaping data inline',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Data and integrations' },
  onAccess: [loadContent('patterns-inline-functions')],
  blocks: [content],
})
