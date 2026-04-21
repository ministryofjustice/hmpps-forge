import { patternStep } from '../../../shared/patternStep'
import { heading, intro, shows, showsList, startButton } from './blocks'

export const overviewStep = patternStep({
  path: '/overview',
  title: 'Add another',
  reachability: { entryWhen: true },
  metadata: { hiddenFromNav: true },
  blocks: [heading, intro, shows, showsList, startButton],
  sourceBase: 'add-another/demo',
  codeFiles: ['journey.ts', 'overview/step.ts', 'overview/blocks.ts'],
})
