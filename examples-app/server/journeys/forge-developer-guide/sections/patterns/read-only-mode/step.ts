import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const readOnlyModePatternStep = step({
  path: '/read-only-mode',
  title: 'Read-only mode',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Access and permissions' },
  onAccess: [loadContent('patterns-read-only-mode')],
  blocks: [content],
})
