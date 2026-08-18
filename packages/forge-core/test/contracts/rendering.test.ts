import { describe, expect, it } from 'vitest'
import type { ComponentRegistryEntry } from '../../src/components/types/components.type'
import type { BlockDefinition, EvaluatedBlock } from '../../src/components'
import type { ForgeRenderer, RenderContext } from '../../src/framework/types/rendering.type'
import { createForgePackage } from '../../src/authoring'
import { ForgeTestHarness, type RequestTraceEvent } from '../../src/testing'
import type { SerializedTraceSpan } from '../../src/engine/chassis/tracing/traceSpan.type'
import { createRenderClient, createTracedRenderClient } from './contractHelpers'
import {
  basicRenderJourney,
  orderedRenderJourney,
  invisibleBlockRenderJourney,
  asyncRenderJourney,
  nestedFieldMetadataRenderJourney,
  multiNestedRenderJourney,
  scopedOverrideRenderJourney,
  renderingContractComponents,
  contractScopedGlobalComponent,
  contractScopedPackageComponent,
} from './rendering.fixtures'

interface RecordedAssemblePage {
  context: RenderContext
  renderedBlocks: readonly unknown[]
  requestState: Record<string, unknown>
}

interface RecordedCalls {
  renderBlock: { variant: string }[]
  wrapNestedBlock: { variant: string; output: unknown }[]
  assemblePage: RecordedAssemblePage[]
}

interface RecordingRenderer {
  renderer: ForgeRenderer<unknown>
  calls: RecordedCalls
}

function createRecordingRenderer(options: { asyncAssemble?: boolean } = {}): RecordingRenderer {
  const calls: RecordedCalls = { renderBlock: [], wrapNestedBlock: [], assemblePage: [] }

  const renderer: ForgeRenderer<unknown> = {
    renderBlock(entry: ComponentRegistryEntry<BlockDefinition, unknown>, block: EvaluatedBlock<BlockDefinition>) {
      calls.renderBlock.push({ variant: block.variant })

      return entry.render(block)
    },

    wrapNestedBlock(block: BlockDefinition, output: unknown) {
      calls.wrapNestedBlock.push({ variant: block.variant, output })

      return { block, html: output }
    },

    assemblePage(context: RenderContext, renderedBlocks: readonly unknown[], requestState: Record<string, unknown>) {
      calls.assemblePage.push({ context, renderedBlocks, requestState })
      const page = renderedBlocks.join('|')

      return options.asyncAssemble ? Promise.resolve(page) : page
    },
  }

  return { renderer, calls }
}

function renderBlockUnits(traces: RequestTraceEvent[]): readonly SerializedTraceSpan[] {
  const renderPhase = traces[0].trace.phases.find(phase => phase.phase === 'render')
  const renderBlocksUnit = renderPhase?.units.find(unit => unit.kind === 'render.render-blocks')

  return renderBlocksUnit?.children ?? []
}

describe('rendering contracts', () => {
  describe('render output', () => {
    it('should assemble the rendered output for a visible block', async () => {
      // Arrange
      const { renderer } = createRecordingRenderer()
      const client = createRenderClient(basicRenderJourney, renderer, renderingContractComponents)

      // Act
      const result = await client.get('/basic-render/form', { session: {} })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.output).toBe('<input id="fullName" name="fullName" aria-label="Full name">')
      }
    })

    it('should pass the render context and request state to assemblePage', async () => {
      // Arrange
      const { renderer, calls } = createRecordingRenderer()
      const client = createRenderClient(basicRenderJourney, renderer, renderingContractComponents)

      // Act
      await client.get('/basic-render/form', { session: {}, state: { requestId: 'req-1' } })

      // Assert
      expect(calls.assemblePage).toHaveLength(1)
      expect(calls.assemblePage[0].requestState).toEqual({ requestId: 'req-1' })
      expect(calls.assemblePage[0].context.step.title).toBe('Form')
      expect(calls.assemblePage[0].context.blocks).toHaveLength(1)
      expect(calls.assemblePage[0].context.blocks[0].variant).toBe('contractField')
    })

    it('should leave output undefined when no renderer is supplied', async () => {
      // Arrange
      const client = new ForgeTestHarness()
        .registerGlobalComponents(renderingContractComponents)
        .registerPackage(createForgePackage({ journey: basicRenderJourney }))
        .createClient()

      // Act
      const result = await client.get('/basic-render/form', { session: {} })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.output).toBeUndefined()
      }
    })
  })

  describe('block visibility', () => {
    it('should render an invisible block as empty and omit it from the assembled output', async () => {
      // Arrange
      const { renderer, calls } = createRecordingRenderer()
      const client = createRenderClient(invisibleBlockRenderJourney, renderer, renderingContractComponents)

      // Act
      const result = await client.get('/invisible-render/form', { session: {} })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.output).toContain('id="shown"')
        expect(result.output).not.toContain('id="hidden"')
      }

      expect(calls.assemblePage[0].renderedBlocks).toHaveLength(2)
      expect(calls.assemblePage[0].renderedBlocks[1]).toBe('')
    })

    it('should omit an invisible block from the render trace', async () => {
      // Arrange
      const { renderer } = createRecordingRenderer()
      const traces: RequestTraceEvent[] = []
      const client = createTracedRenderClient(
        invisibleBlockRenderJourney,
        renderer,
        traces,
        renderingContractComponents,
      )

      // Act
      await client.get('/invisible-render/form', { session: {} })

      // Assert
      const blockUnits = renderBlockUnits(traces)

      expect(blockUnits).toHaveLength(1)
      expect(blockUnits[0].beginFields).toEqual(expect.objectContaining({ variant: 'contractField' }))
    })
  })

  describe('render invocation', () => {
    it('should render each visible block exactly once', async () => {
      // Arrange
      const { renderer, calls } = createRecordingRenderer()
      const client = createRenderClient(orderedRenderJourney, renderer, renderingContractComponents)

      // Act
      await client.get('/ordered-render/form', { session: {} })

      // Assert
      expect(calls.renderBlock).toHaveLength(3)
      expect(calls.renderBlock.map(call => call.variant)).toEqual(['contractField', 'contractField', 'contractField'])
    })

    it('should not invoke the renderer for a block hidden by visibleWhen', async () => {
      // Arrange
      const { renderer, calls } = createRecordingRenderer()
      const client = createRenderClient(invisibleBlockRenderJourney, renderer, renderingContractComponents)

      // Act
      await client.get('/invisible-render/form', { session: {} })

      // Assert
      expect(calls.renderBlock).toHaveLength(1)
    })
  })

  describe('async components', () => {
    it('should await an async component render before assembling', async () => {
      // Arrange
      const { renderer } = createRecordingRenderer()
      const client = createRenderClient(asyncRenderJourney, renderer, renderingContractComponents)

      // Act
      const result = await client.get('/async-render/form', { session: {} })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.output).toContain('<async id="asyncField">')
        expect(result.output).toContain('id="syncField"')
      }
    })

    it('should await an async assemblePage before returning output', async () => {
      // Arrange
      const { renderer } = createRecordingRenderer({ asyncAssemble: true })
      const client = createRenderClient(basicRenderJourney, renderer, renderingContractComponents)

      // Act
      const result = await client.get('/basic-render/form', { session: {} })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.output).toBe('<input id="fullName" name="fullName" aria-label="Full name">')
      }
    })
  })

  describe('nested blocks', () => {
    it('should wrap a nested block and expose it to the parent component', async () => {
      // Arrange
      const { renderer, calls } = createRecordingRenderer()
      const client = createRenderClient(nestedFieldMetadataRenderJourney, renderer, renderingContractComponents)

      // Act
      const result = await client.get('/nested-field-meta/form', { session: {} })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.output).toContain('data-nested-field-code="goal_title"')
        expect(result.output).toContain('id="goal_title"')
      }

      expect(calls.wrapNestedBlock).toHaveLength(1)
      expect(calls.wrapNestedBlock[0].variant).toBe('contractField')
    })

    it('should wrap multiple nested blocks in authored order', async () => {
      // Arrange
      const { renderer, calls } = createRecordingRenderer()
      const client = createRenderClient(multiNestedRenderJourney, renderer, renderingContractComponents)

      // Act
      const result = await client.get('/multi-nested-render/form', { session: {} })

      // Assert
      expect(calls.wrapNestedBlock).toHaveLength(3)

      if (result.type === 'render') {
        const output = result.output as string

        expect(output.indexOf('id="alpha"')).toBeLessThan(output.indexOf('id="bravo"'))
        expect(output.indexOf('id="bravo"')).toBeLessThan(output.indexOf('id="charlie"'))
      }
    })
  })

  describe('component registry', () => {
    it('should render a package-scoped component in preference to a global one of the same variant', async () => {
      // Arrange
      const { renderer } = createRecordingRenderer()
      const client = new ForgeTestHarness()
        .registerGlobalComponents([contractScopedGlobalComponent])
        .registerPackage(
          createForgePackage({
            journey: scopedOverrideRenderJourney,
            components: [contractScopedPackageComponent],
          }),
        )
        .createClient(renderer)

      // Act
      const result = await client.get('/scoped-override-render/form', { session: {} })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.output).toBe('<scoped id="scopedField">')
      }
    })
  })

  describe('block ordering', () => {
    it('should preserve authored block order in the assembled output', async () => {
      // Arrange
      const { renderer, calls } = createRecordingRenderer()
      const client = createRenderClient(orderedRenderJourney, renderer, renderingContractComponents)

      // Act
      const result = await client.get('/ordered-render/form', { session: {} })

      // Assert
      expect(calls.assemblePage[0].renderedBlocks).toHaveLength(3)

      if (result.type === 'render') {
        const output = result.output as string

        expect(output.indexOf('id="firstName"')).toBeLessThan(output.indexOf('id="lastName"'))
        expect(output.indexOf('id="lastName"')).toBeLessThan(output.indexOf('id="email"'))
      }
    })
  })

  describe('render trace', () => {
    it('should emit render-blocks and assemble-page work units', async () => {
      // Arrange
      const { renderer } = createRecordingRenderer()
      const traces: RequestTraceEvent[] = []
      const client = createTracedRenderClient(basicRenderJourney, renderer, traces, renderingContractComponents)

      // Act
      await client.get('/basic-render/form', { session: {} })

      // Assert
      expect(traces).toHaveLength(1)
      expect(traces[0].trace.phases).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            phase: 'render',
            units: expect.arrayContaining([
              expect.objectContaining({
                kind: 'render.render-blocks',
                children: expect.arrayContaining([
                  expect.objectContaining({
                    kind: 'render.render-blocks.block',
                    beginFields: expect.objectContaining({ variant: 'contractField' }),
                  }),
                ]),
              }),
              expect.objectContaining({ kind: 'render.assemble-page' }),
            ]),
          }),
        ]),
      )
    })
  })
})
