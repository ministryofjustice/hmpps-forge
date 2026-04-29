import { patternStep } from '../../../shared/patternStep'
import {
  heading,
  drawDate,
  numbersRow,
  sectionBreak,
  bonusBallLabel,
  bonusBall,
  drawAgainButton,
} from './blocks'

export const drawStep = patternStep({
  path: '/draw',
  title: 'Your lottery draw',
  reachability: { entryWhen: true },
  metadata: { hiddenFromNav: true },
  blocks: [heading, drawDate, numbersRow, sectionBreak, bonusBallLabel, bonusBall, drawAgainButton],
  sourceBase: 'load-reference-data/demo',
  codeFiles: [
    'draw/blocks.ts',
    { path: '/../../components/lotteryBall.ts' },
    {
      path: '/effects.ts',
      lines: [
        [65, 66],
        [289, 295],
      ],
    },
  ],
})
