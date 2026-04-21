import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../effects'
import { content } from '../blocks/blocks'

export const taskListPatternStep = step({
  path: '/task-list',
  title: 'Task list',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Entry and routing' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('patterns-task-list')],
    }),
  ],
  blocks: [content],
})
