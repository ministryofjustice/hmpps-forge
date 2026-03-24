import nunjucks from 'nunjucks'

import { RenderContext, Evaluated } from '@form-engine/core/runtime/rendering/types'
import ComponentRegistry from '@form-engine/registry/ComponentRegistry'
import { BlockASTNode } from '@form-engine/core/types/structures.type'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { BlockType, StructureType } from '@form-engine/form/types/enums'
import TemplateRenderer from './TemplateRenderer'
import { TemplateContext } from './types'

describe('TemplateRenderer', () => {
  let renderer: TemplateRenderer
  let mockNunjucksEnv: jest.Mocked<nunjucks.Environment>
  let mockComponentRegistry: jest.Mocked<ComponentRegistry>

  beforeEach(() => {
    mockNunjucksEnv = {
      render: jest.fn().mockReturnValue('<html>rendered</html>'),
    } as unknown as jest.Mocked<nunjucks.Environment>

    mockComponentRegistry = {
      get: jest.fn(),
      getAll: jest.fn().mockReturnValue(new Map()),
    } as unknown as jest.Mocked<ComponentRegistry>

    renderer = new TemplateRenderer({
      nunjucksEnv: mockNunjucksEnv,
      componentRegistry: mockComponentRegistry,
    })
  })

  function createRenderContext(overrides: Partial<RenderContext> = {}): RenderContext {
    return {
      navigation: [],
      step: { path: '/step', title: 'Test Step' },
      ancestors: [{ code: 'test-journey', path: '/journey', title: 'Test Journey' }],
      blocks: [],
      showValidationFailures: false,
      validationErrors: [],
      answers: {},
      data: {},
      ...overrides,
    }
  }

  function createMockBlock(overrides: Partial<Evaluated<BlockASTNode>> = {}): Evaluated<BlockASTNode> {
    return {
      id: 'compile_ast:1',
      type: ASTNodeType.BLOCK,
      variant: 'text-input',
      blockType: BlockType.FIELD,
      properties: {},
      ...overrides,
    }
  }

  describe('render()', () => {
    it('should render page with blocks and return HTML string', () => {
      // Arrange
      mockComponentRegistry.get.mockReturnValue({
        variant: 'text-input',
        render: jest.fn().mockReturnValue('<input type="text" />'),
      })

      const context = createRenderContext({
        blocks: [createMockBlock()],
      })

      // Act
      const result = renderer.render(context)

      // Assert
      expect(result).toBe('<html>rendered</html>')
      expect(mockNunjucksEnv.render).toHaveBeenCalled()
    })

    it('should pass rendered blocks to template context', () => {
      // Arrange
      mockComponentRegistry.get.mockReturnValue({
        variant: 'text-input',
        render: jest.fn().mockReturnValue('<input type="text" />'),
      })

      const context = createRenderContext({
        blocks: [createMockBlock()],
      })

      // Act
      renderer.render(context)

      // Assert
      const templateContext = mockNunjucksEnv.render.mock.calls[0][1] as TemplateContext
      expect(templateContext.blocks).toEqual(['<input type="text" />'])
    })

    it('should include step, ancestors, navigation, answers, and data in template context', () => {
      // Arrange
      const context = createRenderContext({
        answers: { email: 'test@example.com' },
        data: { userId: '123' },
      })

      // Act
      renderer.render(context)

      // Assert
      const templateContext = mockNunjucksEnv.render.mock.calls[0][1] as TemplateContext
      expect(templateContext.step).toEqual({ path: '/step', title: 'Test Step' })
      expect(templateContext.ancestors).toEqual([{ code: 'test-journey', path: '/journey', title: 'Test Journey' }])
      expect(templateContext.navigation).toEqual([])
      expect(templateContext.answers).toEqual({ email: 'test@example.com' })
      expect(templateContext.data).toEqual({ userId: '123' })
    })

    it('should merge provided locals into template context', () => {
      // Arrange
      const context = createRenderContext()
      const locals = { csrfToken: 'abc123', applicationName: 'My App' }

      // Act
      renderer.render(context, locals)

      // Assert
      const templateContext = mockNunjucksEnv.render.mock.calls[0][1] as TemplateContext
      expect(templateContext.csrfToken).toBe('abc123')
      expect(templateContext.applicationName).toBe('My App')
    })

    it('should filter out hidden blocks', () => {
      // Arrange
      mockComponentRegistry.get.mockReturnValue({
        variant: 'text-input',
        render: jest.fn().mockReturnValue('<input />'),
      })

      const visibleBlock = createMockBlock({ id: 'compile_ast:1' })
      const hiddenBlock = createMockBlock({
        id: 'compile_ast:2',
        properties: { hidden: true },
      })

      const context = createRenderContext({
        blocks: [visibleBlock, hiddenBlock],
      })

      // Act
      renderer.render(context)

      // Assert
      const templateContext = mockNunjucksEnv.render.mock.calls[0][1] as TemplateContext
      expect(templateContext.blocks).toHaveLength(1)
    })

    it('should throw error when Nunjucks render fails', () => {
      // Arrange
      mockNunjucksEnv.render.mockImplementation(() => {
        throw new Error('Template syntax error')
      })

      const context = createRenderContext()

      // Act & Assert
      expect(() => renderer.render(context)).toThrow('Template syntax error')
    })
  })

  describe('resolveTemplate()', () => {
    it('should use step template when specified', () => {
      // Arrange
      const context = createRenderContext({
        step: { path: '/step', title: 'Test', view: { template: 'custom-step.njk' } },
      })

      // Act
      renderer.render(context)

      // Assert
      expect(mockNunjucksEnv.render).toHaveBeenCalledWith('custom-step.njk', expect.any(Object))
    })

    it('should use immediate parent template when step has no template', () => {
      // Arrange
      const context = createRenderContext({
        step: { path: '/step', title: 'Test' },
        ancestors: [
          { code: 'root', path: '/root', title: 'Root', view: { template: 'root-template.njk' } },
          { code: 'parent', path: '/parent', title: 'Parent', view: { template: 'parent-template.njk' } },
        ],
      })

      // Act
      renderer.render(context)

      // Assert
      expect(mockNunjucksEnv.render).toHaveBeenCalledWith('parent-template.njk', expect.any(Object))
    })

    it('should fall back to ancestor template when immediate parent has no template', () => {
      // Arrange
      const context = createRenderContext({
        step: { path: '/step', title: 'Test' },
        ancestors: [
          { code: 'root', path: '/root', title: 'Root', view: { template: 'root-template.njk' } },
          { code: 'parent', path: '/parent', title: 'Parent' },
        ],
      })

      // Act
      renderer.render(context)

      // Assert
      expect(mockNunjucksEnv.render).toHaveBeenCalledWith('root-template.njk', expect.any(Object))
    })

    it('should use default template when no template specified anywhere', () => {
      // Arrange
      const context = createRenderContext({
        step: { path: '/step', title: 'Test' },
        ancestors: [{ code: 'journey', path: '/journey', title: 'Journey' }],
      })

      // Act
      renderer.render(context)

      // Assert
      expect(mockNunjucksEnv.render).toHaveBeenCalledWith('form-step.njk', expect.any(Object))
    })

    it('should append .njk extension when not present', () => {
      // Arrange
      const context = createRenderContext({
        step: { path: '/step', title: 'Test', view: { template: 'custom-template' } },
      })

      // Act
      renderer.render(context)

      // Assert
      expect(mockNunjucksEnv.render).toHaveBeenCalledWith('custom-template.njk', expect.any(Object))
    })

    it('should not double-append .njk extension', () => {
      // Arrange
      const context = createRenderContext({
        step: { path: '/step', title: 'Test', view: { template: 'custom-template.njk' } },
      })

      // Act
      renderer.render(context)

      // Assert
      expect(mockNunjucksEnv.render).toHaveBeenCalledWith('custom-template.njk', expect.any(Object))
    })
  })

  describe('mergeViewLocals()', () => {
    it('should merge ancestor locals in order from root to immediate parent', () => {
      // Arrange
      const context = createRenderContext({
        ancestors: [
          { code: 'root', path: '/root', title: 'Root', view: { locals: { theme: 'light', brand: 'default' } } },
          { code: 'parent', path: '/parent', title: 'Parent', view: { locals: { theme: 'dark' } } },
        ],
      })

      // Act
      renderer.render(context)

      // Assert
      const templateContext = mockNunjucksEnv.render.mock.calls[0][1] as TemplateContext
      expect(templateContext.theme).toBe('dark')
      expect(templateContext.brand).toBe('default')
    })

    it('should merge step locals with highest priority', () => {
      // Arrange
      const context = createRenderContext({
        step: { path: '/step', title: 'Test', view: { locals: { theme: 'custom', stepVar: 'value' } } },
        ancestors: [{ code: 'journey', path: '/journey', title: 'Journey', view: { locals: { theme: 'dark' } } }],
      })

      // Act
      renderer.render(context)

      // Assert
      const templateContext = mockNunjucksEnv.render.mock.calls[0][1] as TemplateContext
      expect(templateContext.theme).toBe('custom')
      expect(templateContext.stepVar).toBe('value')
    })

    it('should handle ancestors without view config', () => {
      // Arrange
      const context = createRenderContext({
        ancestors: [
          { code: 'root', path: '/root', title: 'Root' },
          { code: 'parent', path: '/parent', title: 'Parent', view: { locals: { parentVar: 'value' } } },
        ],
      })

      // Act
      renderer.render(context)

      // Assert
      const templateContext = mockNunjucksEnv.render.mock.calls[0][1] as TemplateContext
      expect(templateContext.parentVar).toBe('value')
    })

    it('should handle ancestors with view but no locals', () => {
      // Arrange
      const context = createRenderContext({
        ancestors: [{ code: 'journey', path: '/journey', title: 'Journey', view: { template: 'custom.njk' } }],
      })

      // Act
      renderer.render(context)

      // Assert
      const templateContext = mockNunjucksEnv.render.mock.calls[0][1] as TemplateContext
      expect(templateContext.step).toBeDefined()
    })
  })

  describe('renderBlock()', () => {
    it('should throw error when component variant not found', () => {
      // Arrange
      mockComponentRegistry.get.mockReturnValue(undefined)
      mockComponentRegistry.getAll.mockReturnValue(
        new Map([
          ['html', { variant: 'html', render: jest.fn() }],
          ['radios', { variant: 'radios', render: jest.fn() }],
        ]),
      )

      const context = createRenderContext({
        blocks: [createMockBlock({ variant: 'unknown-component' })],
      })

      // Act & Assert
      expect(() => renderer.render(context)).toThrow(
        'Component variant "unknown-component" not found in registry. Available variants: html, radios',
      )
    })

    it('should call component render with evaluated block', () => {
      // Arrange
      const mockRender = jest.fn().mockReturnValue('<input />')
      mockComponentRegistry.get.mockReturnValue({
        variant: 'text-input',
        render: mockRender,
      })

      const context = createRenderContext({
        blocks: [
          createMockBlock({
            variant: 'text-input',
            properties: { label: 'Email', name: 'email' },
          }),
        ],
      })

      // Act
      renderer.render(context)

      // Assert
      expect(mockRender).toHaveBeenCalledWith(
        expect.objectContaining({
          type: StructureType.BLOCK,
          variant: 'text-input',
          label: 'Email',
          name: 'email',
          errors: [],
        }),
        mockNunjucksEnv,
      )
    })
  })

  describe('extractErrorsFromValidations()', () => {
    it('should extract failed validations as errors when showValidationFailures is true', () => {
      // Arrange
      const mockRender = jest.fn().mockReturnValue('<input />')
      mockComponentRegistry.get.mockReturnValue({
        variant: 'text-input',
        render: mockRender,
      })

      const context = createRenderContext({
        showValidationFailures: true,
        blocks: [
          createMockBlock({
            properties: {
              validate: [
                { passed: false, message: 'Email is required', details: { field: 'email' } },
                { passed: true, message: 'Email is valid' },
                { passed: false, message: 'Email format is invalid' },
              ],
            },
          }),
        ],
      })

      // Act
      renderer.render(context)

      // Assert
      expect(mockRender).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: [
            { message: 'Email is required', details: { field: 'email' } },
            { message: 'Email format is invalid', details: undefined },
          ],
        }),
        mockNunjucksEnv,
      )
    })

    it('should not include errors when showValidationFailures is false', () => {
      // Arrange
      const mockRender = jest.fn().mockReturnValue('<input />')
      mockComponentRegistry.get.mockReturnValue({
        variant: 'text-input',
        render: mockRender,
      })

      const context = createRenderContext({
        showValidationFailures: false,
        blocks: [
          createMockBlock({
            properties: {
              validate: [{ passed: false, message: 'Email is required' }],
            },
          }),
        ],
      })

      // Act
      renderer.render(context)

      // Assert
      expect(mockRender).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: [],
        }),
        mockNunjucksEnv,
      )
    })

    it('should handle validate property that is not an array', () => {
      // Arrange
      const mockRender = jest.fn().mockReturnValue('<input />')
      mockComponentRegistry.get.mockReturnValue({
        variant: 'text-input',
        render: mockRender,
      })

      const context = createRenderContext({
        showValidationFailures: true,
        blocks: [
          createMockBlock({
            properties: { validate: 'not-an-array' },
          }),
        ],
      })

      // Act
      renderer.render(context)

      // Assert
      expect(mockRender).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: [],
        }),
        mockNunjucksEnv,
      )
    })
  })

  describe('transformPropertiesWithRenderedBlocks()', () => {
    it('should render nested blocks to RenderedBlock format', () => {
      // Arrange
      const mockRender = jest.fn().mockReturnValue('<div>Nested content</div>')
      mockComponentRegistry.get.mockReturnValue({
        variant: 'fieldset',
        render: mockRender,
      })

      const nestedBlock: Evaluated<BlockASTNode> = {
        id: 'compile_ast:10',
        type: ASTNodeType.BLOCK,
        variant: 'fieldset',
        blockType: BlockType.BASIC,
        properties: { content: 'Nested' },
      }

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
      renderer.render(context)

      // Assert
      expect(mockRender).toHaveBeenCalledTimes(2)
      const parentCallArgs = mockRender.mock.calls[1][0]
      expect(parentCallArgs.children).toEqual({
        block: { type: StructureType.BLOCK, blockType: BlockType.BASIC, variant: 'fieldset', content: 'Nested' },
        html: '<div>Nested content</div>',
      })
    })

    it('should handle arrays with nested blocks', () => {
      // Arrange
      const mockRender = jest.fn().mockReturnValue('<div>Block</div>')
      mockComponentRegistry.get.mockReturnValue({
        variant: 'html',
        render: mockRender,
      })

      const nestedBlocks: Evaluated<BlockASTNode>[] = [
        {
          id: 'compile_ast:20',
          type: ASTNodeType.BLOCK,
          variant: 'html',
          blockType: BlockType.BASIC,
          properties: {},
        },
        {
          id: 'compile_ast:21',
          type: ASTNodeType.BLOCK,
          variant: 'html',
          blockType: BlockType.BASIC,
          properties: {},
        },
      ]

      const context = createRenderContext({
        blocks: [
          createMockBlock({
            variant: 'html',
            properties: { items: nestedBlocks },
          }),
        ],
      })

      // Act
      renderer.render(context)

      // Assert
      const parentCallArgs = mockRender.mock.calls[2][0]
      expect(parentCallArgs.items).toHaveLength(2)
      expect(parentCallArgs.items[0].html).toBe('<div>Block</div>')
    })

    it('should filter out hidden nested blocks from arrays', () => {
      // Arrange
      const mockRender = jest.fn().mockReturnValue('<div>Block</div>')
      mockComponentRegistry.get.mockReturnValue({
        variant: 'html',
        render: mockRender,
      })

      const visibleBlock: Evaluated<BlockASTNode> = {
        id: 'compile_ast:20',
        type: ASTNodeType.BLOCK,
        variant: 'html',
        blockType: BlockType.BASIC,
        properties: {},
      }

      const hiddenBlock: Evaluated<BlockASTNode> = {
        id: 'compile_ast:21',
        type: ASTNodeType.BLOCK,
        variant: 'html',
        blockType: BlockType.BASIC,
        properties: { hidden: true },
      }

      const context = createRenderContext({
        blocks: [
          createMockBlock({
            variant: 'html',
            properties: { items: [visibleBlock, hiddenBlock] },
          }),
        ],
      })

      // Act
      renderer.render(context)

      // Assert
      const parentCallArgs = mockRender.mock.calls[1][0]
      expect(parentCallArgs.items).toHaveLength(1)
      expect(parentCallArgs.items[0].html).toBe('<div>Block</div>')
    })

    it('should recursively transform nested objects', () => {
      // Arrange
      const mockRender = jest.fn().mockReturnValue('<span>Hint</span>')
      mockComponentRegistry.get.mockReturnValue({
        variant: 'text-input',
        render: mockRender,
      })

      const nestedBlock: Evaluated<BlockASTNode> = {
        id: 'compile_ast:30',
        type: ASTNodeType.BLOCK,
        variant: 'text-input',
        blockType: BlockType.BASIC,
        properties: {},
      }

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
      renderer.render(context)

      // Assert
      const parentCallArgs = mockRender.mock.calls[1][0]
      expect(parentCallArgs.config.hint.content.html).toBe('<span>Hint</span>')
    })

    it('should preserve null and undefined values', () => {
      // Arrange
      const mockRender = jest.fn().mockReturnValue('<input />')
      mockComponentRegistry.get.mockReturnValue({
        variant: 'text-input',
        render: mockRender,
      })

      const context = createRenderContext({
        blocks: [
          createMockBlock({
            properties: {
              label: 'Test',
              hint: null,
              description: undefined,
            },
          }),
        ],
      })

      // Act
      renderer.render(context)

      // Assert
      expect(mockRender).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'Test',
          hint: null,
          description: undefined,
        }),
        mockNunjucksEnv,
      )
    })

    it('should preserve primitive values unchanged', () => {
      // Arrange
      const mockRender = jest.fn().mockReturnValue('<input />')
      mockComponentRegistry.get.mockReturnValue({
        variant: 'text-input',
        render: mockRender,
      })

      const context = createRenderContext({
        blocks: [
          createMockBlock({
            properties: {
              label: 'Test Label',
              maxLength: 100,
              required: true,
            },
          }),
        ],
      })

      // Act
      renderer.render(context)

      // Assert
      expect(mockRender).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'Test Label',
          maxLength: 100,
          required: true,
        }),
        mockNunjucksEnv,
      )
    })
  })

  describe('render() edge cases', () => {
    it('should handle empty blocks array', () => {
      // Arrange
      const context = createRenderContext({ blocks: [] })

      // Act
      renderer.render(context)

      // Assert
      const templateContext = mockNunjucksEnv.render.mock.calls[0][1] as TemplateContext
      expect(templateContext.blocks).toEqual([])
    })

    it('should handle empty ancestors array', () => {
      // Arrange
      const context = createRenderContext({ ancestors: [] })

      // Act
      renderer.render(context)

      // Assert
      expect(mockNunjucksEnv.render).toHaveBeenCalledWith('form-step.njk', expect.any(Object))
    })

    it('should return empty string when Nunjucks returns empty string', () => {
      // Arrange
      ;(mockNunjucksEnv.render as jest.Mock).mockReturnValue('')

      const context = createRenderContext()

      // Act
      const result = renderer.render(context)

      // Assert
      expect(result).toBe('')
    })
  })
})
