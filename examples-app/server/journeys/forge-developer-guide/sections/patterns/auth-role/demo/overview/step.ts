import { patternStep } from '../../../shared/patternStep'
import { heading, intro, shows, showsList, startButton } from './blocks'

export const overviewStep = patternStep({
  path: '/overview',
  title: 'Require authentication / role',
  reachability: { entryWhen: true },
  metadata: { hiddenFromNav: true },
  blocks: [heading, intro, shows, showsList, startButton],
  sourceBase: 'auth-role/demo',
  codeFiles: ['journey.ts', 'guards.ts', 'overview/step.ts', 'overview/blocks.ts'],
})
