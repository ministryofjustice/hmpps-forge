import { describe, expect, it } from 'vitest'
import type { BlockDefinition } from '../../../../src/components'
import type { ForgeRenderer, RenderContext } from '../../../../src/framework'
import { ForgeTestHarness, type RequestTraceEvent } from '../../../../src/testing'
import {
  RenderFunctionProbe,
  renderFunctionSpikePackage,
  type RenderFunctionDependencies,
} from './renderFunctions.fixtures'

function createRenderer(): ForgeRenderer<unknown> {
  return {
    wrapNestedBlock(block: BlockDefinition, output: unknown) {
      return { block, html: String(output) }
    },

    assemblePage(_context: RenderContext, _renderedBlocks: readonly unknown[]) {
      throw new Error('Custom step renderer should replace adapter page assembly')
    },
  }
}

function createClient(traces?: RequestTraceEvent[]) {
  return new ForgeTestHarness({
      instrumentation:
        traces === undefined
          ? undefined
          : {
              sinks: [{ onRequestTrace: event => traces.push(event) }],
            },
    }).registerPackage<RenderFunctionDependencies>(renderFunctionSpikePackage, { prefix: 'package' })
      .createClient(createRenderer())
}

function requestDependencies(id: string, probe: RenderFunctionProbe) {
  return () => ({ renderRequest: { id, probe } })
}

describe('presentation function contracts', () => {
  describe('vertical execution', () => {
    it('should render request-bound blocks through an inherited step renderer', async () => {
      // Arrange
      const probe = new RenderFunctionProbe()
      const client = createClient()

      // Act
      const result = await client.get('/render-functions-spike/inherited', {
        session: {},
        requestDependencies: requestDependencies('inherited-request', probe),
      })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.output).toBe(
          '<page data-request="inherited-request"><h1>Expression-aware heading</h1>' +
            'package:inherited-request:page chrome' +
            'package:inherited-request:expression-aware block|' +
            'package:inherited-request:second|' +
            '<container>package:inherited-request:nested</container>|' +
            '<input id="name-input" aria-label="Name"></page>',
        )
        expect(result.context.renderer?.variant).toBe('renderSpikePage')
        expect(result.context.step).not.toHaveProperty('renderer')
        expect(result.context.ancestors.every(ancestor => ancestor.renderer === undefined)).toBe(true)
      }

      expect(probe.maximumConcurrency()).toBe(2)
      expect(probe.eventIndex('finish:nested')).toBeLessThan(probe.eventIndex('start:container'))
      expect(probe.factoryCount('renderSpikeLeaf')).toBe(1)
      expect(probe.factoryCount('renderSpikeContainer')).toBe(1)
      expect(probe.factoryCount('renderSpikeField')).toBe(1)
      expect(probe.factoryCount('renderSpikePage')).toBe(1)
      expect(probe.factoryCount('renderSpikeAlternatePage')).toBe(1)
      expect(probe.factoryCount('renderSpikeTwoColumnPage')).toBe(1)
      expect(probe.factoryCount('renderSpikeOptionalBlocksPage')).toBe(1)
    })

    it('should preserve a typed block structure for a custom renderer', async () => {
      // Arrange
      const probe = new RenderFunctionProbe()
      const client = createClient()

      // Act
      const result = await client.get('/render-functions-spike/structured', {
        session: {},
        requestDependencies: requestDependencies('structured-request', probe),
      })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.output).toBe(
          '<two-column data-request="structured-request">' +
            '<main>package:structured-request:main content</main>' +
            '<aside>package:structured-request:aside content</aside>' +
            '</two-column>',
        )
        expect(result.context.blocks.map(block => block.properties.label)).toEqual(['first', 'second'])
      }

      expect(probe.maximumConcurrency()).toBe(2)
    })

    it('should preserve omitted blocks as undefined for a renderer that accepts them', async () => {
      // Arrange
      const probe = new RenderFunctionProbe()
      const client = createClient()

      // Act
      const result = await client.get('/render-functions-spike/optional-blocks', {
        session: {},
        requestDependencies: requestDependencies('optional-request', probe),
      })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.output).toBe('<optional-blocks data-request="optional-request">none</optional-blocks>')
        expect(result.context.blocks).toEqual([])
      }
    })

    it('should replace an inherited renderer with the complete step invocation', async () => {
      // Arrange
      const probe = new RenderFunctionProbe()
      const client = createClient()

      // Act
      const result = await client.get('/render-functions-spike/replacement', {
        session: {},
        requestDependencies: requestDependencies('replacement-request', probe),
      })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.output).toContain('<alternate data-request="replacement-request"><h1>Replacement heading</h1>')
        expect(result.context.renderer?.variant).toBe('renderSpikeAlternatePage')
      }
    })

    it('should isolate evaluators and dependencies between concurrent requests', async () => {
      // Arrange
      const firstProbe = new RenderFunctionProbe()
      const secondProbe = new RenderFunctionProbe()
      const client = createClient()

      // Act
      const [firstResult, secondResult] = await Promise.all([
        client.get('/render-functions-spike/inherited', {
          session: {},
          requestDependencies: requestDependencies('first-request', firstProbe),
        }),
        client.get('/render-functions-spike/inherited', {
          session: {},
          requestDependencies: requestDependencies('second-request', secondProbe),
        }),
      ])

      // Assert
      expect(firstResult.type).toBe('render')
      expect(secondResult.type).toBe('render')

      if (firstResult.type === 'render' && secondResult.type === 'render') {
        expect(firstResult.output).toContain('data-request="first-request"')
        expect(firstResult.output).not.toContain('second-request')
        expect(secondResult.output).toContain('data-request="second-request"')
        expect(secondResult.output).not.toContain('first-request')
      }

      expect(firstProbe.factoryCount('renderSpikeLeaf')).toBe(1)
      expect(secondProbe.factoryCount('renderSpikeLeaf')).toBe(1)
    })

    it('should attribute a rendering failure to its render invocation in the trace', async () => {
      // Arrange
      const traces: RequestTraceEvent[] = []
      const probe = new RenderFunctionProbe('first')
      const client = createClient(traces)

      // Act
      const result = await client.get('/render-functions-spike/inherited', {
        session: {},
        requestDependencies: requestDependencies('failing-request', probe),
      })

      // Assert
      expect(result.type).toBe('error')
      expect(traces).toHaveLength(1)
      expect(traces[0].trace.outcome).toBe('error')

      const renderPhase = traces[0].trace.phases.find(phase => phase.phase === 'render')
      const renderBlocks = renderPhase?.units.find(unit => unit.kind === 'render.render-blocks')
      const failingInvocation = renderBlocks?.children.find(unit => {
        return unit.beginFields.variant === 'renderSpikeLeaf' && typeof unit.beginFields.id === 'string'
      })

      expect(failingInvocation).toBeDefined()
    })
  })
})
