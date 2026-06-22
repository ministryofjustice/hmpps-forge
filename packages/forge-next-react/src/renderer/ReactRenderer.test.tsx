import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { BlockType, StructureType } from '@ministryofjustice/hmpps-forge/core/authoring'
import type {
  BlockDefinition,
  ComponentRegistryEntry,
  EvaluatedBlock,
} from '@ministryofjustice/hmpps-forge/core/components'
import type { ReactNode } from 'react'
import type { RenderContext } from '@ministryofjustice/hmpps-forge/core/framework'

import { FORGE_REACT_ACTION, ReactRenderer } from './ReactRenderer'

function createRenderContext(overrides: Partial<RenderContext> = {}): RenderContext {
  return {
    routeTree: [],
    step: { path: '/step', title: 'Test Step' },
    ancestors: [{ code: 'test-journey', path: '/journey', title: 'Test Journey' }],
    blocks: [],
    showValidationFailures: false,
    fieldValidationErrors: [],
    domainValidationErrors: [],
    answers: {},
    data: {},
    ...overrides,
  }
}

function createEvaluatedBlock(): EvaluatedBlock<BlockDefinition> {
  return {
    type: StructureType.BLOCK,
    blockType: BlockType.BASIC,
    variant: 'text',
    nodeId: 'compile_ast:1',
    errors: [],
  } as unknown as EvaluatedBlock<BlockDefinition>
}

function createEntry(render: (_block: EvaluatedBlock<BlockDefinition>, _rendererContext?: unknown) => unknown) {
  return { variant: 'text', render } as ComponentRegistryEntry<BlockDefinition, ReactNode>
}

describe('ReactRenderer', () => {
  describe('renderBlock()', () => {
    it('should render the block through its component', async () => {
      // Arrange
      const renderer = new ReactRenderer()
      const entry = createEntry(() => <p>Hello</p>)

      // Act
      const node = await renderer.renderBlock(entry, createEvaluatedBlock())

      // Assert
      expect(renderToStaticMarkup(node)).toBe('<p>Hello</p>')
    })

    it('should pass the renderer context to the component when one is configured', async () => {
      // Arrange
      const rendererContext = { theme: 'dark' }
      const renderer = new ReactRenderer({ rendererContext })
      const render = vi.fn().mockReturnValue(<p>Hello</p>)
      const entry = createEntry(render)
      const block = createEvaluatedBlock()

      // Act
      await renderer.renderBlock(entry, block)

      // Assert
      expect(render).toHaveBeenCalledWith(block, rendererContext)
    })

    it('should throw when the component output is not a React node', async () => {
      // Arrange
      const renderer = new ReactRenderer()
      const entry = createEntry(() => ({ unsupported: true }))

      // Act & Assert
      await expect(renderer.renderBlock(entry, createEvaluatedBlock())).rejects.toThrow(
        'Component variant "text" must render a React node for the Next React adapter.',
      )
    })

    it('should await async component output', async () => {
      // Arrange
      const renderer = new ReactRenderer()
      const entry = createEntry(async () => <p>Async</p>)

      // Act
      const node = await renderer.renderBlock(entry, createEvaluatedBlock())

      // Assert
      expect(renderToStaticMarkup(node)).toBe('<p>Async</p>')
    })
  })

  describe('wrapNestedBlock()', () => {
    it('should wrap a rendered child with its block metadata', () => {
      // Arrange
      const renderer = new ReactRenderer()
      const block = {
        type: StructureType.BLOCK,
        blockType: BlockType.BASIC,
        variant: 'text',
      } as unknown as BlockDefinition
      const node = <p>Nested</p>

      // Act
      const wrapped = renderer.wrapNestedBlock(block, node)

      // Assert
      expect(wrapped).toEqual({ block, node })
    })
  })

  describe('assemblePage()', () => {
    it('should assemble the default page with the action from the request state', () => {
      // Arrange
      const renderer = new ReactRenderer()
      const context = createRenderContext()

      // Act
      const page = renderer.assemblePage(context, [<p key="1">Hello</p>], { [FORGE_REACT_ACTION]: '/forms/step' })
      const html = renderToStaticMarkup(page)

      // Assert
      expect(html).toContain('<title>Test Step</title>')
      expect(html).toContain('<form action="/forms/step" method="post">')
      expect(html).toContain('<p>Hello</p>')
    })

    it('should fall back to the step path when no action is in the request state', () => {
      // Arrange
      const renderer = new ReactRenderer()
      const context = createRenderContext()

      // Act
      const page = renderer.assemblePage(context, [], {})
      const html = renderToStaticMarkup(page)

      // Assert
      expect(html).toContain('<form action="/step" method="post">')
    })

    it('should assemble through a custom page renderer when one is configured', () => {
      // Arrange
      const page = vi.fn().mockReturnValue(<section>Custom</section>)
      const renderer = new ReactRenderer({ page })
      const context = createRenderContext()
      const blocks = [<p key="1">Hello</p>]

      // Act
      const node = renderer.assemblePage(context, blocks, { [FORGE_REACT_ACTION]: '/forms/step' })

      // Assert
      expect(renderToStaticMarkup(node)).toBe('<section>Custom</section>')
      expect(page).toHaveBeenCalledWith({ context, blocks, action: '/forms/step' })
    })
  })
})
