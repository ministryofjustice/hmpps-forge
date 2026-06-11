import { createRenderOutputTerminal } from './renderOutputTerminal'
import { createPipelineState } from '../testing-helpers/pipelineStateFixtures'
import { BlockType } from '../../../../authoring/types/enums'
import { RENDER_BLOCK_BRAND } from '../../../contracts/compiled/renderBlock.brand'
import type { ForgeRenderer, RenderBlock, RenderContext } from '../../../../framework/rendering/types'
import type { ComponentRegistry } from '../../../../framework/types/adapter.type'

function createRenderContext(blocks: RenderBlock[] = []): RenderContext {
  return {
    routeTree: [],
    step: { path: '/step', title: 'Test Step' },
    ancestors: [],
    blocks,
    showValidationFailures: false,
    fieldValidationErrors: [],
    domainValidationErrors: [],
    answers: {},
    data: {},
  }
}

function createMockBlock(): RenderBlock {
  const block: RenderBlock = {
    id: 'compile_ast:1',
    variant: 'text-input',
    blockType: BlockType.FIELD,
    properties: {},
  }

  Object.assign(block, { [RENDER_BLOCK_BRAND]: true })

  return block
}

describe('renderOutputTerminal', () => {
  describe('execute()', () => {
    it('should return a context-only render result when no renderer is bound', async () => {
      // Arrange
      const componentRegistry = { get: vi.fn(), getAll: vi.fn() } as unknown as ComponentRegistry
      const terminal = createRenderOutputTerminal<undefined>(componentRegistry, undefined)
      const renderContext = createRenderContext()

      // Act
      const result = await terminal.execute({ ...createPipelineState(), renderContext })

      // Assert
      expect(result).toEqual({ type: 'render', context: renderContext, output: undefined, renderedBlocks: [] })
    })

    it('should drive the renderer per block and assemble the page', async () => {
      // Arrange
      const componentRegistry = {
        get: vi.fn().mockReturnValue({ variant: 'text-input', render: vi.fn().mockReturnValue('<input />') }),
        getAll: vi.fn().mockReturnValue(new Map()),
      } as unknown as ComponentRegistry
      const renderer: ForgeRenderer<string> = {
        renderBlock: vi.fn((entry, block) => entry.render(block) as string),
        wrapNestedBlock: vi.fn(),
        assemblePage: vi.fn().mockReturnValue('<html>page</html>'),
      }
      const terminal = createRenderOutputTerminal(componentRegistry, renderer)
      const renderContext = createRenderContext([createMockBlock()])
      const state = { ...createPipelineState(), renderContext }

      // Act
      const result = await terminal.execute(state)

      // Assert
      expect(renderer.assemblePage).toHaveBeenCalledWith(renderContext, ['<input />'], state.request.getAllState())
      expect(result).toEqual({
        type: 'render',
        context: renderContext,
        output: '<html>page</html>',
        renderedBlocks: ['<input />'],
      })
    })

    it('should throw when no render context is on the state', async () => {
      // Arrange
      const componentRegistry = { get: vi.fn(), getAll: vi.fn() } as unknown as ComponentRegistry
      const terminal = createRenderOutputTerminal<undefined>(componentRegistry, undefined)

      // Act & Assert
      await expect(terminal.execute(createPipelineState())).rejects.toThrow(
        'No render context on pipeline state: render-evaluation phase did not run',
      )
    })
  })
})
