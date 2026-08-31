import { z } from 'zod'
import { Data, blockSchema, component, createForgePackage, journey, renderer, step } from '../../../../src/authoring'
import type { BlockDefinition, RendererFunctionContext } from '../../../../src/components'

export interface RenderRequestDependencies {
  readonly id: string
  readonly probe: RenderFunctionProbe
}

export interface RenderFunctionDependencies {
  readonly prefix: string
  readonly renderRequest?: RenderRequestDependencies
}

export class RenderFunctionProbe {
  private readonly factoryCalls = new Map<string, number>()

  private readonly events: string[] = []

  private activeTopLevelBlocks = 0

  private startedTopLevelBlocks = 0

  private releaseTopLevelBlocks: () => void = () => {}

  private readonly topLevelBlocksReady = new Promise<void>(resolve => {
    this.releaseTopLevelBlocks = resolve
  })

  private maximumActiveTopLevelBlocks = 0

  constructor(private readonly failingLabel?: string) {}

  recordFactory(variant: string): void {
    this.factoryCalls.set(variant, (this.factoryCalls.get(variant) ?? 0) + 1)
  }

  async renderBlock(label: string, output: string): Promise<string> {
    this.events.push(`start:${label}`)

    if (label === 'first' || label === 'second') {
      this.activeTopLevelBlocks += 1
      this.startedTopLevelBlocks += 1
      this.maximumActiveTopLevelBlocks = Math.max(this.maximumActiveTopLevelBlocks, this.activeTopLevelBlocks)

      if (this.startedTopLevelBlocks === 2) {
        this.releaseTopLevelBlocks()
      }

      await this.topLevelBlocksReady
      this.activeTopLevelBlocks -= 1
    }

    if (label === this.failingLabel) {
      throw new Error(`Render spike failed for ${label}`)
    }

    this.events.push(`finish:${label}`)

    return output
  }

  factoryCount(variant: string): number {
    return this.factoryCalls.get(variant) ?? 0
  }

  maximumConcurrency(): number {
    return this.maximumActiveTopLevelBlocks
  }

  eventIndex(event: string): number {
    return this.events.indexOf(event)
  }
}

interface TestLeafProps {
  label: string
  text: string
}

interface TestContainerProps {
  label: string
  child: BlockDefinition
}

interface TestFieldProps {
  label: string
}

interface TestPageProps {
  heading: string
  chrome?: BlockDefinition
}

interface TwoColumnBlocks {
  main: BlockDefinition[]
  aside: BlockDefinition[]
}

const twoColumnStep = step<TwoColumnBlocks>

const TestLeaf = component<TestLeafProps, RenderFunctionDependencies>('renderSpikeLeaf', {
  factory: dependencies => {
    const request = bindRequest(dependencies, 'renderSpikeLeaf')

    return async props => {
      return request.probe.renderBlock(props.label, `${dependencies.prefix}:${request.id}:${props.text}`)
    }
  },
})

const TestContainer = component<TestContainerProps, RenderFunctionDependencies>('renderSpikeContainer', {
  factory: dependencies => {
    const request = bindRequest(dependencies, 'renderSpikeContainer')

    return async props => {
      return request.probe.renderBlock(props.label, `<container>${props.child.html}</container>`)
    }
  },
})

const TestField = component<TestFieldProps, RenderFunctionDependencies>('renderSpikeField', {
  field: true,
  inputSchema: z.string(),
  errorAnchor: props => `${props.code}-input`,
  factory: dependencies => {
    const request = bindRequest(dependencies, 'renderSpikeField')

    return async props => {
      return request.probe.renderBlock('field', `<input id="${props.code}-input" aria-label="${props.label}">`)
    }
  },
})

const TestPage = renderer<TestPageProps, BlockDefinition[], RendererFunctionContext, RenderFunctionDependencies>(
  'renderSpikePage',
  {
    factory: dependencies => {
      const request = bindRequest(dependencies, 'renderSpikePage')

      return (blocks, props) => {
        const children = blocks.map(block => block.html).join('|')
        const chrome = props.chrome?.html ?? ''

        return `<page data-request="${request.id}"><h1>${props.heading}</h1>${chrome}${children}</page>`
      }
    },
  },
)

const AlternatePage = renderer<TestPageProps, BlockDefinition[], RendererFunctionContext, RenderFunctionDependencies>(
  'renderSpikeAlternatePage',
  {
    factory: dependencies => {
      const request = bindRequest(dependencies, 'renderSpikeAlternatePage')

      return (blocks, props) => {
        const children = blocks.map(block => block.html).join('|')

        return `<alternate data-request="${request.id}"><h1>${props.heading}</h1>${children}</alternate>`
      }
    },
  },
)

const TwoColumnPage = renderer<TestPageProps, TwoColumnBlocks, RendererFunctionContext, RenderFunctionDependencies>(
  'renderSpikeTwoColumnPage',
  {
    blocksSchema: z.strictObject({
      main: z.array(blockSchema),
      aside: z.array(blockSchema),
    }),
    factory: dependencies => {
      const request = bindRequest(dependencies, 'renderSpikeTwoColumnPage')

      return blocks => {
        const main = blocks.main.map(block => block.html).join('|')
        const aside = blocks.aside.map(block => block.html).join('|')

        return `<two-column data-request="${request.id}"><main>${main}</main><aside>${aside}</aside></two-column>`
      }
    },
  },
)

const OptionalBlocksPage = renderer<
  TestPageProps,
  TwoColumnBlocks | undefined,
  RendererFunctionContext,
  RenderFunctionDependencies
>('renderSpikeOptionalBlocksPage', {
  blocksSchema: z
    .strictObject({
      main: z.array(blockSchema),
      aside: z.array(blockSchema),
    })
    .optional(),
  factory: dependencies => {
    const request = bindRequest(dependencies, 'renderSpikeOptionalBlocksPage')

    return blocks =>
      `<optional-blocks data-request="${request.id}">${blocks === undefined ? 'none' : 'present'}</optional-blocks>`
  },
})

const sharedBlocks = () => [
  TestLeaf({ label: 'first', text: Data('message') }),
  TestLeaf({ label: 'second', text: 'second' }),
  TestContainer({
    label: 'container',
    child: TestLeaf({ label: 'nested', text: 'nested' }),
  }),
  TestField({ code: 'name', label: 'Name' }),
]

export const renderFunctionSpikePackage = createForgePackage<RenderFunctionDependencies>({
  journey: journey({
    code: 'render-functions-spike',
    path: '/render-functions-spike',
    title: 'Render functions spike',
    data: {
      heading: 'Expression-aware heading',
      message: 'expression-aware block',
    },
    renderer: TestPage({
      heading: Data('heading'),
      chrome: TestLeaf({ label: 'page-nested', text: 'page chrome' }),
    }),
    steps: [
      step({
        path: '/inherited',
        title: 'Inherited renderer',
        reachability: { entryWhen: true },
        blocks: sharedBlocks(),
      }),
      step({
        path: '/replacement',
        title: 'Replacement renderer',
        reachability: { entryWhen: true },
        renderer: AlternatePage({ heading: 'Replacement heading' }),
        blocks: sharedBlocks(),
      }),
      twoColumnStep({
        path: '/structured',
        title: 'Structured renderer',
        reachability: { entryWhen: true },
        renderer: TwoColumnPage({ heading: 'Structured heading' }),
        blocks: {
          main: [TestLeaf({ label: 'first', text: 'main content' })],
          aside: [TestLeaf({ label: 'second', text: 'aside content' })],
        },
      }),
      step<TwoColumnBlocks | undefined>({
        path: '/optional-blocks',
        title: 'Optional structured blocks',
        reachability: { entryWhen: true },
        renderer: OptionalBlocksPage({ heading: 'Optional blocks' }),
      }),
    ],
  }),
})

function bindRequest(dependencies: RenderFunctionDependencies, variant: string): RenderRequestDependencies {
  const request = dependencies.renderRequest

  if (request === undefined) {
    throw new Error(`Render function "${variant}" requires request dependencies`)
  }

  request.probe.recordFactory(variant)

  return request
}
