import { patternStep } from '../../../shared/patternStep'
import { heading, intro, shows, showsList, startButton } from './blocks'

export const overviewStep = patternStep({
  path: '/overview',
  title: 'Read-only mode',
  reachability: { entryWhen: true },
  metadata: { hiddenFromNav: true },
  blocks: [heading, intro, shows, showsList, startButton],
  sourceBase: 'read-only-mode/demo',
  codeFiles: ['journey.ts', 'guards.ts', 'overview/step.ts', 'overview/blocks.ts'],
})
