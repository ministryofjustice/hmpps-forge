import { z } from 'zod'
import { Data, component, createForgePackage, journey, renderer, step } from '../../../../src/authoring'
import type { BlockDefinition } from '../../../../src/components'

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

const TestLeaf = component<TestLeafProps, RenderFunctionDependencies>('renderSpikeLeaf', {
  factory: dependencies => {
    const request = bindRequest(dependencies, 'renderSpikeLeaf')

    return async input => {
      return request.probe.renderBlock(input.props.label, `${dependencies.prefix}:${request.id}:${input.props.text}`)
    }
  },
})

const TestContainer = component<TestContainerProps, RenderFunctionDependencies>('renderSpikeContainer', {
  factory: dependencies => {
    const request = bindRequest(dependencies, 'renderSpikeContainer')

    return async input => {
      return request.probe.renderBlock(input.props.label, `<container>${input.props.child.html}</container>`)
    }
  },
})

const TestField = component<TestFieldProps, RenderFunctionDependencies>('renderSpikeField', {
  field: true,
  inputSchema: z.string(),
  errorAnchor: props => `${props.code}-input`,
  factory: dependencies => {
    const request = bindRequest(dependencies, 'renderSpikeField')

    return async input => {
      return request.probe.renderBlock(
        'field',
        `<input id="${input.props.code}-input" aria-label="${input.props.label}">`,
      )
    }
  },
})

const TestPage = renderer<TestPageProps, RenderFunctionDependencies>('renderSpikePage', {
  factory: dependencies => {
    const request = bindRequest(dependencies, 'renderSpikePage')

    return input => {
      const children = input.context.children.map(child => child.output).join('|')
      const chrome = input.props.chrome?.html ?? ''

      return `<page data-request="${request.id}"><h1>${input.props.heading}</h1>${chrome}${children}</page>`
    }
  },
})

const AlternatePage = renderer<TestPageProps, RenderFunctionDependencies>('renderSpikeAlternatePage', {
  factory: dependencies => {
    const request = bindRequest(dependencies, 'renderSpikeAlternatePage')

    return input => {
      const children = input.context.children.map(child => child.output).join('|')

      return `<alternate data-request="${request.id}"><h1>${input.props.heading}</h1>${children}</alternate>`
    }
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
