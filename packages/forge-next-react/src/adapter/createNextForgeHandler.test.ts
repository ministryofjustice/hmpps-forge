import { describe, expect, it, vi } from 'vitest'
import { Forge } from '@ministryofjustice/hmpps-forge/core'
import { block, journey, step } from '@ministryofjustice/hmpps-forge/core/authoring'
import type {
  BasicBlockProps,
  BlockDefinition,
  ComponentRegistryEntry,
} from '@ministryofjustice/hmpps-forge/core/components'
import type { RequestTraceEvent, TraceObserver } from '@ministryofjustice/hmpps-forge/core'

import { createNextForgeHandler } from './createNextForgeHandler'
import { SimpleSubmitButton, SimpleText, SimpleTextInput, simpleReactComponents } from '../components/simpleComponents'

const silentLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
} as unknown as Console

interface BrokenReactBlockProps extends BasicBlockProps {
  label: string
}

interface BrokenReactBlock extends BlockDefinition, BrokenReactBlockProps {
  variant: 'brokenReact'
}

function createSimpleForge(): Forge {
  const simpleJourney = journey({
    code: 'demo',
    path: '/demo',
    title: 'Demo journey',
    reachability: { disableReachabilityChecks: true },
    steps: [
      step({
        code: 'start',
        path: '/start',
        title: 'Start',
        blocks: [
          SimpleText({ text: 'Hello from React' }),
          SimpleTextInput({ code: 'name', label: 'Name', hint: 'Use any name' }),
          SimpleSubmitButton({ text: 'Continue' }),
        ],
      }),
    ],
  })

  return new Forge({ logger: silentLogger })
    .registerGlobalComponents(simpleReactComponents)
    .registerPackage({ journey: simpleJourney })
}

function BrokenReactBlock(props: BrokenReactBlockProps): BrokenReactBlock {
  return block<BrokenReactBlock>({ ...props, variant: 'brokenReact' })
}

const brokenReactComponent: ComponentRegistryEntry<BrokenReactBlock, unknown> = {
  variant: 'brokenReact',
  render() {
    return { unsupported: true }
  },
}

describe('createNextForgeHandler', () => {
  it('should render a Forge step with simple React components when handling a GET request', async () => {
    // Arrange
    const forge = createSimpleForge()
    const handler = createNextForgeHandler(forge)
    const request = new Request('http://localhost/demo/start')

    // Act
    const response = await handler.GET(request)
    const html = await response.text()

    // Assert
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8')
    expect(html).toContain('<p>Hello from React</p>')
    expect(html).toContain('<form action="/demo/start" method="post">')
    expect(html).toContain('<label for="name">Name</label>')
    expect(html).toContain('name="name"')
    expect(html).toContain('<button type="submit">Continue</button>')
  })

  it('should redirect from a journey root route when Forge returns a navigate outcome', async () => {
    // Arrange
    const forge = createSimpleForge()
    const handler = createNextForgeHandler(forge)
    const request = new Request('http://localhost/demo')

    // Act
    const response = await handler.GET(request)

    // Assert
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('http://localhost/demo/start')
  })

  it('should return method not supported when the path exists for another method', async () => {
    // Arrange
    const forge = createSimpleForge()
    const handler = createNextForgeHandler(forge)
    const request = new Request('http://localhost/demo', { method: 'POST' })

    // Act
    const response = await handler.POST(request)
    const body = await response.text()

    // Assert
    expect(response.status).toBe(405)
    expect(body).toContain('POST not allowed')
  })

  it('should load and save adapter-managed session state around evaluation', async () => {
    // Arrange
    const forge = createSimpleForge()
    const session = { user: 'Terry' }
    const save = vi.fn()
    const handler = createNextForgeHandler(forge, {
      sessionStore: {
        load: () => session,
        save,
      },
    })
    const request = new Request('http://localhost/demo/start')

    // Act
    const response = await handler.GET(request)

    // Assert
    expect(response.status).toBe(200)
    expect(save).toHaveBeenCalledWith(session, response, request)
  })

  it('should emit adapter render and commit work units when tracing is enabled', async () => {
    // Arrange
    const forge = createSimpleForge()
    const traces: RequestTraceEvent[] = []
    const traceObserver: TraceObserver = {
      shouldTrace: () => true,
      onTrace: trace => traces.push(trace),
    }
    const handler = createNextForgeHandler(forge, { traceObserver })
    const request = new Request('http://localhost/demo/start')

    // Act
    await handler.GET(request)

    // Assert
    const kinds = traces.flatMap(trace => trace.trace.phases.flatMap(phase => collectUnitKinds(phase.units)))
    const phases = traces.flatMap(trace => trace.trace.phases.map(phase => phase.phase))

    expect(phases).toContain('resolve')
    expect(kinds).toContain('resolve.block')
    expect(kinds).toContain('resolve.blocks')
    expect(kinds).toContain('adapter.render.block')
    expect(kinds).toContain('adapter.render.assemble')
    expect(kinds).toContain('adapter.commit')
  })

  it('should reject component output that cannot be rendered as a React node', async () => {
    // Arrange
    const brokenJourney = journey({
      code: 'broken',
      path: '/broken',
      title: 'Broken journey',
      reachability: { disableReachabilityChecks: true },
      steps: [
        step({
          code: 'start',
          path: '/start',
          title: 'Start',
          blocks: [BrokenReactBlock({ label: 'Broken' })],
        }),
      ],
    })
    const forge = new Forge({ logger: silentLogger })
      .registerGlobalComponent(brokenReactComponent)
      .registerPackage({ journey: brokenJourney })
    const handler = createNextForgeHandler(forge)
    const request = new Request('http://localhost/broken/start')

    // Act & Assert
    await expect(handler.GET(request)).rejects.toThrow(
      'Component variant "brokenReact" must render a React node for the Next React adapter.',
    )
  })
})

interface TraceUnitLike {
  readonly kind: string
  readonly children: readonly TraceUnitLike[]
}

function collectUnitKinds(units: readonly TraceUnitLike[]): string[] {
  return units.flatMap(unit => [unit.kind, ...collectUnitKinds(unit.children)])
}
