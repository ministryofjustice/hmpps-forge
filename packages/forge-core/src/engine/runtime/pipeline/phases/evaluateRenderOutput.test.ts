import { evaluateRenderOutput } from './evaluateRenderOutput'
import TraceRecorder from '../trace/TraceRecorder'
import { BlockType, StructureType } from '../../../../authoring/types/enums'
import { RENDER_BLOCK_BRAND } from '../../../contracts/compiled/renderBlock.brand'
import type { ForgeRenderer, RenderBlock, RenderContext } from '../../../../framework/rendering/types'
import type { ComponentRegistry } from '../../../../framework/types/adapter.type'

describe('evaluateRenderOutput', () => {
  let renderer: ForgeRenderer<string>
  let mockComponentRegistry: Mocked<ComponentRegistry>

  beforeEach(() => {
    mockComponentRegistry = {
      get: vi.fn(),
      getAll: vi.fn().mockReturnValue(new Map()),
    } as unknown as Mocked<ComponentRegistry>

    renderer = {
      renderBlock: vi.fn((entry, block) => entry.render(block) as string),
      wrapNestedBlock: vi.fn((block, output) => ({ block, html: output })),
      assemblePage: vi.fn(),
    }
  })

  function walk(context: RenderContext): string[] {
    return evaluateRenderOutput(context, mockComponentRegistry, renderer)
  }

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

  function createMockBlock(overrides: Partial<RenderBlock> = {}): RenderBlock {
    const block: RenderBlock = {
      id: 'compile_ast:1',
      variant: 'text-input',
      blockType: BlockType.FIELD,
      properties: {},
      ...overrides,
    }

    Object.assign(block, { [RENDER_BLOCK_BRAND]: true })

    return block
  }

  describe('block walk', () => {
    it('should return top-level outputs in render order', () => {
      // Arrange
      mockComponentRegistry.get.mockReturnValue({
        variant: 'text-input',
        render: vi.fn().mockReturnValue('<input />'),
      })

      const context = createRenderContext({
        blocks: [createMockBlock({ id: 'compile_ast:1' }), createMockBlock({ id: 'compile_ast:2' })],
      })

      // Act
      const outputs = walk(context)

      // Assert
      expect(outputs).toEqual(['<input />', '<input />'])
    })

    it('should filter out blocks where visibleWhen is false', () => {
      // Arrange
      mockComponentRegistry.get.mockReturnValue({
        variant: 'text-input',
        render: vi.fn().mockReturnValue('<input />'),
      })

      const visibleBlock = createMockBlock({ id: 'compile_ast:1' })
      const hiddenBlock = createMockBlock({
        id: 'compile_ast:2',
        properties: { visibleWhen: false },
      })

      const context = createRenderContext({
        blocks: [visibleBlock, hiddenBlock],
      })

      // Act
      const outputs = walk(context)

      // Assert
      expect(outputs).toHaveLength(1)
    })

    it('should throw error when component variant not found', () => {
      // Arrange
      mockComponentRegistry.get.mockReturnValue(undefined)
      mockComponentRegistry.getAll.mockReturnValue(
        new Map([
          ['html', { variant: 'html', render: vi.fn() }],
          ['radios', { variant: 'radios', render: vi.fn() }],
        ]),
      )

      const context = createRenderContext({
        blocks: [createMockBlock({ variant: 'unknown-component' })],
      })

      // Act & Assert
      expect(() => walk(context)).toThrow(
        'Component variant "unknown-component" not found in registry. Available variants: html, radios',
      )
    })

    it('should pass the evaluated block to the renderer with the resolved entry', () => {
      // Arrange
      const mockRender = vi.fn().mockReturnValue('<input />')
      const entry = { variant: 'text-input', render: mockRender }

      mockComponentRegistry.get.mockReturnValue(entry)

      const context = createRenderContext({
        blocks: [
          createMockBlock({
            variant: 'text-input',
            properties: { label: 'Email', name: 'email' },
          }),
        ],
      })

      // Act
      walk(context)

      // Assert
      expect(renderer.renderBlock).toHaveBeenCalledWith(
        entry,
        expect.objectContaining({
          type: StructureType.BLOCK,
          variant: 'text-input',
          nodeId: 'compile_ast:1',
          label: 'Email',
          name: 'email',
          errors: [],
        }),
      )
    })

    it('should extract failed validations as errors when showValidationFailures is true', () => {
      // Arrange
      const mockRender = vi.fn().mockReturnValue('<input />')

      mockComponentRegistry.get.mockReturnValue({ variant: 'text-input', render: mockRender })

      const context = createRenderContext({
        showValidationFailures: true,
        blocks: [
          createMockBlock({
            properties: {
              validWhen: [
                { passed: false, message: 'Email is required', details: { field: 'email' } },
                { passed: true, message: 'Email is valid' },
                { passed: false, message: 'Email format is invalid' },
              ],
            },
          }),
        ],
      })

      // Act
      walk(context)

      // Assert
      expect(mockRender).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: [
            { message: 'Email is required', details: { field: 'email' } },
            { message: 'Email format is invalid', details: undefined },
          ],
        }),
      )
    })

    it('should not include errors when showValidationFailures is false', () => {
      // Arrange
      const mockRender = vi.fn().mockReturnValue('<input />')

      mockComponentRegistry.get.mockReturnValue({ variant: 'text-input', render: mockRender })

      const context = createRenderContext({
        showValidationFailures: false,
        blocks: [
          createMockBlock({
            properties: {
              validWhen: [{ passed: false, message: 'Email is required' }],
            },
          }),
        ],
      })

      // Act
      walk(context)

      // Assert
      expect(mockRender).toHaveBeenCalledWith(expect.objectContaining({ errors: [] }))
    })

    it('should handle validWhen property that is not an array', () => {
      // Arrange
      const mockRender = vi.fn().mockReturnValue('<input />')

      mockComponentRegistry.get.mockReturnValue({ variant: 'text-input', render: mockRender })

      const context = createRenderContext({
        showValidationFailures: true,
        blocks: [
          createMockBlock({
            properties: { validWhen: 'not-an-array' },
          }),
        ],
      })

      // Act
      walk(context)

      // Assert
      expect(mockRender).toHaveBeenCalledWith(expect.objectContaining({ errors: [] }))
    })

    it('should wrap nested blocks with the renderer stripping visibleWhen from metadata', () => {
      // Arrange
      const mockRender = vi.fn().mockReturnValue('<div>Nested content</div>')

      mockComponentRegistry.get.mockReturnValue({ variant: 'fieldset', render: mockRender })

      const nestedBlock = createMockBlock({
        id: 'compile_ast:10',
        variant: 'fieldset',
        blockType: BlockType.BASIC,
        properties: { content: 'Nested', visibleWhen: true },
      })

      const context = createRenderContext({
        blocks: [
          createMockBlock({
            variant: 'fieldset',
            properties: {
              legend: 'Test Fieldset',
              children: nestedBlock,
            },
          }),
        ],
      })

      // Act
      walk(context)

      // Assert
      expect(mockRender).toHaveBeenCalledTimes(2)
      expect(renderer.wrapNestedBlock).toHaveBeenCalledWith(
        { type: StructureType.BLOCK, blockType: BlockType.BASIC, variant: 'fieldset', content: 'Nested' },
        '<div>Nested content</div>',
      )

      const parentCallArgs = mockRender.mock.calls[1][0] as Record<string, unknown>

      expect(parentCallArgs.children).toEqual({
        block: { type: StructureType.BLOCK, blockType: BlockType.BASIC, variant: 'fieldset', content: 'Nested' },
        html: '<div>Nested content</div>',
      })
    })

    it('should filter out non-visible nested blocks from arrays', () => {
      // Arrange
      const mockRender = vi.fn().mockReturnValue('<div>Block</div>')

      mockComponentRegistry.get.mockReturnValue({ variant: 'html', render: mockRender })

      const visibleBlock = createMockBlock({ id: 'compile_ast:20', variant: 'html', blockType: BlockType.BASIC })
      const hiddenBlock = createMockBlock({
        id: 'compile_ast:21',
        variant: 'html',
        blockType: BlockType.BASIC,
        properties: { visibleWhen: false },
      })

      const context = createRenderContext({
        blocks: [
          createMockBlock({
            variant: 'html',
            properties: { items: [visibleBlock, hiddenBlock] },
          }),
        ],
      })

      // Act
      walk(context)

      // Assert
      const parentCallArgs = mockRender.mock.calls[1][0] as Record<string, { html: string }[]>

      expect(parentCallArgs.items).toHaveLength(1)
      expect(parentCallArgs.items[0].html).toBe('<div>Block</div>')
    })

    it('should recursively transform nested objects', () => {
      // Arrange
      const mockRender = vi.fn().mockReturnValue('<span>Hint</span>')

      mockComponentRegistry.get.mockReturnValue({ variant: 'text-input', render: mockRender })

      const nestedBlock = createMockBlock({
        id: 'compile_ast:30',
        variant: 'text-input',
        blockType: BlockType.BASIC,
      })

      const context = createRenderContext({
        blocks: [
          createMockBlock({
            variant: 'text-input',
            properties: {
              config: {
                hint: {
                  content: nestedBlock,
                },
              },
            },
          }),
        ],
      })

      // Act
      walk(context)

      // Assert
      const parentCallArgs = mockRender.mock.calls[1][0] as { config: { hint: { content: { html: string } } } }

      expect(parentCallArgs.config.hint.content.html).toBe('<span>Hint</span>')
    })

    it('should preserve null, undefined, and primitive values unchanged', () => {
      // Arrange
      const mockRender = vi.fn().mockReturnValue('<input />')

      mockComponentRegistry.get.mockReturnValue({ variant: 'text-input', render: mockRender })

      const context = createRenderContext({
        blocks: [
          createMockBlock({
            properties: {
              label: 'Test Label',
              maxLength: 100,
              required: true,
              hint: null,
              description: undefined,
            },
          }),
        ],
      })

      // Act
      walk(context)

      // Assert
      expect(mockRender).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'Test Label',
          maxLength: 100,
          required: true,
          hint: null,
          description: undefined,
        }),
      )
    })
  })

  describe('tracing', () => {
    const runTraced = (context: RenderContext) => {
      const recorder = new TraceRecorder()

      recorder.beginPhase('render-output')

      const outputs = evaluateRenderOutput(context, mockComponentRegistry, renderer, recorder)

      recorder.endPhase('render')

      return { outputs, units: recorder.finish('render').phases[0].units }
    }

    it('should record nested blocks as children of their parent in the trace tree', () => {
      // Arrange
      mockComponentRegistry.get.mockReturnValue({
        variant: 'fieldset',
        render: vi.fn().mockReturnValue('<div />'),
      })

      const nestedBlock = createMockBlock({ id: 'compile_ast:10', variant: 'fieldset', blockType: BlockType.BASIC })
      const context = createRenderContext({
        blocks: [
          createMockBlock({
            id: 'compile_ast:9',
            variant: 'fieldset',
            properties: { children: nestedBlock },
          }),
        ],
      })

      // Act
      const { units } = runTraced(context)

      // Assert
      expect(units).toHaveLength(1)
      expect(units[0]).toEqual(
        expect.objectContaining({
          kind: 'block-render',
          nodeId: 'compile_ast:9',
          variant: 'fieldset',
          children: [expect.objectContaining({ kind: 'block-render', nodeId: 'compile_ast:10', variant: 'fieldset' })],
        }),
      )
    })

    it('should nest three levels deep when blocks are deeply nested', () => {
      // Arrange
      mockComponentRegistry.get.mockReturnValue({
        variant: 'fieldset',
        render: vi.fn().mockReturnValue('<div />'),
      })

      const grandchild = createMockBlock({ id: 'compile_ast:11', variant: 'fieldset', blockType: BlockType.BASIC })
      const child = createMockBlock({ id: 'compile_ast:10', variant: 'fieldset', properties: { children: grandchild } })
      const context = createRenderContext({
        blocks: [
          createMockBlock({
            id: 'compile_ast:9',
            variant: 'fieldset',
            properties: { children: child },
          }),
        ],
      })

      // Act
      const { units } = runTraced(context)

      // Assert
      expect(units).toHaveLength(1)
      const parent = units[0] as { children?: readonly unknown[] }
      expect(parent.children).toHaveLength(1)

      const childUnit = parent.children![0] as { children?: readonly unknown[] }
      expect(childUnit).toEqual(expect.objectContaining({ nodeId: 'compile_ast:10' }))
      expect(childUnit.children).toHaveLength(1)
      expect(childUnit.children![0]).toEqual(expect.objectContaining({ nodeId: 'compile_ast:11' }))
    })

    it('should not include children field on leaf blocks', () => {
      // Arrange
      mockComponentRegistry.get.mockReturnValue({
        variant: 'text-input',
        render: vi.fn().mockReturnValue('<input />'),
      })

      const context = createRenderContext({
        blocks: [createMockBlock({ id: 'compile_ast:1' }), createMockBlock({ id: 'compile_ast:2' })],
      })

      // Act
      const { units } = runTraced(context)

      // Assert
      expect(units).toHaveLength(2)
      expect(units[0]).not.toHaveProperty('children')
      expect(units[1]).not.toHaveProperty('children')
    })

    it('should record nothing and still render when no recorder is supplied', () => {
      // Arrange
      mockComponentRegistry.get.mockReturnValue({
        variant: 'text-input',
        render: vi.fn().mockReturnValue('<input />'),
      })

      const context = createRenderContext({ blocks: [createMockBlock()] })

      // Act
      const outputs = walk(context)

      // Assert
      expect(outputs).toEqual(['<input />'])
    })
  })
})
