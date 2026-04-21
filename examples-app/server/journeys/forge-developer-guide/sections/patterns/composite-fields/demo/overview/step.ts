import { patternStep } from '../../../shared/patternStep'
import { heading, intro, shows, showsList, startButton } from './blocks'

export const overviewStep = patternStep({
  path: '/overview',
  title: 'Multi-part composite fields',
  reachability: { entryWhen: true },
  metadata: { hiddenFromNav: true },
  blocks: [heading, intro, shows, showsList, startButton],
  sourceBase: 'composite-fields/demo',
  codeFiles: ['journey.ts', 'overview/step.ts', 'overview/blocks.ts'],
})
