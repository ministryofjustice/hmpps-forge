import { patternStep } from '../../../shared/patternStep'
import { heading, intro, taskList } from './blocks'

export const tasksStep = patternStep({
  code: 'tasks',
  path: '/tasks',
  title: 'Book a prison visit',
  reachability: { entryWhen: true },
  blocks: [heading, intro, taskList],
  sourceBase: 'task-list/demo/tasks',
  codeFiles: ['step.ts', 'blocks.ts'],
})
