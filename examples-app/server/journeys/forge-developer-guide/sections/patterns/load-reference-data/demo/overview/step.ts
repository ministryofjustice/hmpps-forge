import { patternStep } from '../../../shared/patternStep'
import { heading, intro, shows, showsList, startButton } from './blocks'

export const overviewStep = patternStep({
  path: '/overview',
  title: 'Load reference data on access',
  reachability: { entryWhen: true },
  metadata: { hiddenFromNav: true },
  blocks: [heading, intro, shows, showsList, startButton],
  sourceBase: 'load-reference-data/demo',
  codeFiles: [
    'journey.ts',
    {
      path: '/effects.ts',
      lines: [
        [65, 66],
        [289, 295],
      ],
    },
    'overview/blocks.ts',
  ],
})
