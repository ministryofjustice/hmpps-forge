import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const taskListPatternStep = step({
  path: '/task-list',
  title: 'Task list',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Entry and routing' },
  onAccess: [loadContent('patterns-task-list')],
  blocks: [content],
})
