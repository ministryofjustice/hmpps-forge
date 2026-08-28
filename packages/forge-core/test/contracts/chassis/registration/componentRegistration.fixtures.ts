import { journey, step } from '../../../../src/authoring'
import { component, type BlockDefinition } from '../../../../src/components'

export interface TestCardBlock {
  title: string
}

export const TestCard = component<TestCardBlock>('test-card', { render: card => `<h2>${card.title}</h2>` })

export function journeyWithBlocks(blocks: BlockDefinition[]) {
  return journey({
    code: 'components',
    title: 'Components Journey',
    path: '/components',
    reachability: { disableReachabilityChecks: true },
    steps: [
      step({
        code: 'step-one',
        title: 'Step One',
        path: '/step-one',
        blocks,
      }),
    ],
  })
}
