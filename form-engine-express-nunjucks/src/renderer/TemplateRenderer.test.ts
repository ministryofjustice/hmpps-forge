import nunjucks from 'nunjucks'

import { RenderContext, Evaluated } from '@form-engine/core/runtime/rendering/types'
import ComponentRegistry from '@form-engine/registry/ComponentRegistry'
import { BlockASTNode } from '@form-engine/core/types/structures.type'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { StructureType } from '@form-engine/form/types/enums'
import TemplateRenderer from './TemplateRenderer'
import { TemplateContext } from './types'

describe('TemplateRenderer', () => {
  let renderer: TemplateRenderer
  let mockNunjucksEnv: jest.Mocked<nunjucks.Environment>
  let mockComponentRegistry: jest.Mocked<ComponentRegistry>

  beforeEach(() => {
    mockNunjucksEnv = {
      render: jest.fn((template, data, callback) => {
        callback(null, '<html>rendered</html>')
      }),
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
      blockType: 'field',
      properties: {},
      ...overrides,
    }
  }

  describe('render()', () => {
    it('should render page with blocks and return HTML string', async () => {
      // Arrange
      mockComponentRegistry.get.mockReturnValue({
        variant: 'text-input',
        render: jest.fn().mockResolvedValue('<input type="text" />'),
      })

      const context = createRenderContext({
        blocks: [createMockBlock()],
      })

      // Act
      const result = await renderer.render(context)

      // Assert
      expect(result).toBe('<html>rendered</html>')
      expect(mockNunjucksEnv.render).toHaveBeenCalled()
    })

    it('should pass rendered blocks to template context', async () => {
      // Arrange
      mockComponentRegistry.get.mockReturnValue({
        variant: 'text-input',
        render: jest.fn().mockResolvedValue('<input type="text" />'),
      })

      const context = createRenderContext({
        blocks: [createMockBlock()],
      })

      // Act
      await renderer.render(context)

      // Assert
      const templateContext = mockNunjucksEnv.render.mock.calls[0][1] as TemplateContext
      expect(templateContext.blocks).toEqual(['<input type="text" />'])
    })

    it('should include step, ancestors, navigation, answers, and data in template context', async () => {
      // Arrange
      const context = createRenderContext({
        answers: { email: 'test@example.com' },
        data: { userId: '123' },
      })

      // Act
      await renderer.render(context)

      // Assert
      const templateContext = mockNunjucksEnv.render.mock.calls[0][1] as TemplateContext
      expect(templateContext.step).toEqual({ path: '/step', title: 'Test Step' })
      expect(templateContext.ancestors).toEqual([{ code: 'test-journey', path: '/journey', title: 'Test Journey' }])
      expect(templateContext.navigation).toEqual([])
      expect(templateContext.answers).toEqual({ email: 'test@example.com' })
      expect(templateContext.data).toEqual({ userId: '123' })
    })

    it('should merge provided locals into template context', async () => {
      // Arrange
      const context = createRenderContext()
      const locals = { csrfToken: 'abc123', applicationName: 'My App' }

      // Act
      await renderer.render(context, locals)

      // Assert
      const templateContext = mockNunjucksEnv.render.mock.calls[0][1] as TemplateContext
      expect(templateContext.csrfToken).toBe('abc123')
      expect(templateContext.applicationName).toBe('My App')
    })

    it('should filter out hidden blocks', async () => {
      // Arrange
      mockComponentRegistry.get.mockReturnValue({
        variant: 'text-input',
        render: jest.fn().mockResolvedValue('<input />'),
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
      await renderer.render(context)

      // Assert
      const templateContext = mockNunjucksEnv.render.mock.calls[0][1] as TemplateContext
      expect(templateContext.blocks).toHaveLength(1)
    })

    it('should throw error when Nunjucks render fails', async () => {
      // Arrange
      const renderError = Object.assign(new Error('Template syntax error'), {
        lineno: 1,
        colno: 1,
      }) as nunjucks.lib.TemplateError
      mockNunjucksEnv.render.mockImplementation((template, data, callback) => {
        callback(renderError, null)
      })

      const context = createRenderContext()

      // Act & Assert
      await expect(renderer.render(context)).rejects.toThrow('Template syntax error')
    })
  })

  describe('resolveTemplate()', () => {
    it('should use step template when specified', async () => {
      // Arrange
      const context = createRenderContext({
        step: { path: '/step', title: 'Test', view: { template: 'custom-step.njk' } },
      })

      // Act
      await renderer.render(context)

      // Assert
      expect(mockNunjucksEnv.render).toHaveBeenCalledWith('custom-step.njk', expect.any(Object), expect.any(Function))
    })

    it('should use immediate parent template when step has no template', async () => {
      // Arrange
      const context = createRenderContext({
        step: { path: '/step', title: 'Test' },
        ancestors: [
          { code: 'root', path: '/root', title: 'Root', view: { template: 'root-template.njk' } },
          { code: 'parent', path: '/parent', title: 'Parent', view: { template: 'parent-template.njk' } },
        ],
      })

      // Act
      await renderer.render(context)

      // Assert
      expect(mockNunjucksEnv.render).toHaveBeenCalledWith(
        'parent-template.njk',
        expect.any(Object),
        expect.any(Function),
      )
    })

    it('should fall back to ancestor template when immediate parent has no template', async () => {
      // Arrange
      const context = createRenderContext({
        step: { path: '/step', title: 'Test' },
        ancestors: [
          { code: 'root', path: '/root', title: 'Root', view: { template: 'root-template.njk' } },
          { code: 'parent', path: '/parent', title: 'Parent' },
        ],
      })

      // Act
      await renderer.render(context)

      // Assert
      expect(mockNunjucksEnv.render).toHaveBeenCalledWith('root-template.njk', expect.any(Object), expect.any(Function))
    })

    it('should use default template when no template specified anywhere', async () => {
      // Arrange
      const context = createRenderContext({
        step: { path: '/step', title: 'Test' },
        ancestors: [{ code: 'journey', path: '/journey', title: 'Journey' }],
      })

      // Act
      await renderer.render(context)

      // Assert
      expect(mockNunjucksEnv.render).toHaveBeenCalledWith('form-step.njk', expect.any(Object), expect.any(Function))
    })

    it('should append .njk extension when not present', async () => {
      // Arrange
      const context = createRenderContext({
        step: { path: '/step', title: 'Test', view: { template: 'custom-template' } },
      })

      // Act
      await renderer.render(context)

      // Assert
      expect(mockNunjucksEnv.render).toHaveBeenCalledWith(
        'custom-template.njk',
        expect.any(Object),
        expect.any(Function),
      )
    })

    it('should not double-append .njk extension', async () => {
      // Arrange
      const context = createRenderContext({
        step: { path: '/step', title: 'Test', view: { template: 'custom-template.njk' } },
      })

      // Act
      await renderer.render(context)

      // Assert
      expect(mockNunjucksEnv.render).toHaveBeenCalledWith(
        'custom-template.njk',
        expect.any(Object),
        expect.any(Function),
      )
    })
  })

  describe('mergeViewLocals()', () => {
    it('should merge ancestor locals in order from root to immediate parent', async () => {
      // Arrange
      const context = createRenderContext({
        ancestors: [
          { code: 'root', path: '/root', title: 'Root', view: { locals: { theme: 'light', brand: 'default' } } },
          { code: 'parent', path: '/parent', title: 'Parent', view: { locals: { theme: 'dark' } } },
        ],
      })

      // Act
      await renderer.render(context)

      // Assert
      const templateContext = mockNunjucksEnv.render.mock.calls[0][1] as TemplateContext
      expect(templateContext.theme).toBe('dark')
      expect(templateContext.brand).toBe('default')
    })

    it('should merge step locals with highest priority', async () => {
      // Arrange
      const context = createRenderContext({
        step: { path: '/step', title: 'Test', view: { locals: { theme: 'custom', stepVar: 'value' } } },
        ancestors: [{ code: 'journey', path: '/journey', title: 'Journey', view: { locals: { theme: 'dark' } } }],
      })

      // Act
      await renderer.render(context)

      // Assert
      const templateContext = mockNunjucksEnv.render.mock.calls[0][1] as TemplateContext
      expect(templateContext.theme).toBe('custom')
      expect(templateContext.stepVar).toBe('value')
    })

    it('should handle ancestors without view config', async () => {
      // Arrange
      const context = createRenderContext({
        ancestors: [
          { code: 'root', path: '/root', title: 'Root' },
          { code: 'parent', path: '/parent', title: 'Parent', view: { locals: { parentVar: 'value' } } },
        ],
      })

      // Act
      await renderer.render(context)

      // Assert
      const templateContext = mockNunjucksEnv.render.mock.calls[0][1] as TemplateContext
      expect(templateContext.parentVar).toBe('value')
    })

    it('should handle ancestors with view but no locals', async () => {
      // Arrange
      const context = createRenderContext({
        ancestors: [{ code: 'journey', path: '/journey', title: 'Journey', view: { template: 'custom.njk' } }],
      })

      // Act
      await renderer.render(context)

      // Assert
      const templateContext = mockNunjucksEnv.render.mock.calls[0][1] as TemplateContext
      expect(templateContext.step).toBeDefined()
    })
  })

  describe('renderBlock()', () => {
    it('should throw error when component variant not found', async () => {
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
      await expect(renderer.render(context)).rejects.toThrow(
        'Component variant "unknown-component" not found in registry. Available variants: html, radios',
      )
    })

    it('should call component render with evaluated block', async () => {
      // Arrange
      const mockRender = jest.fn().mockResolvedValue('<input />')
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
      await renderer.render(context)

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
    it('should extract failed validations as errors when showValidationFailures is true', async () => {
      // Arrange
      const mockRender = jest.fn().mockResolvedValue('<input />')
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
      await renderer.render(context)

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

    it('should not include errors when showValidationFailures is false', async () => {
      // Arrange
      const mockRender = jest.fn().mockResolvedValue('<input />')
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
      await renderer.render(context)

      // Assert
      expect(mockRender).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: [],
        }),
        mockNunjucksEnv,
      )
    })

    it('should handle validate property that is not an array', async () => {
      // Arrange
      const mockRender = jest.fn().mockResolvedValue('<input />')
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
      await renderer.render(context)

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
    it('should render nested blocks to RenderedBlock format', async () => {
      // Arrange
      const mockRender = jest.fn().mockResolvedValue('<div>Nested content</div>')
      mockComponentRegistry.get.mockReturnValue({
        variant: 'fieldset',
        render: mockRender,
      })

      const nestedBlock: Evaluated<BlockASTNode> = {
        id: 'compile_ast:10',
        type: ASTNodeType.BLOCK,
        variant: 'fieldset',
        blockType: 'basic',
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
      await renderer.render(context)

      // Assert
      expect(mockRender).toHaveBeenCalledTimes(2)
      const parentCallArgs = mockRender.mock.calls[1][0]
      expect(parentCallArgs.children).toEqual({
        block: { type: StructureType.BLOCK, variant: 'fieldset' },
        html: '<div>Nested content</div>',
      })
    })

    it('should handle arrays with nested blocks', async () => {
      // Arrange
      const mockRender = jest.fn().mockResolvedValue('<div>Block</div>')
      mockComponentRegistry.get.mockReturnValue({
        variant: 'html',
        render: mockRender,
      })

      const nestedBlocks: Evaluated<BlockASTNode>[] = [
        {
          id: 'compile_ast:20',
          type: ASTNodeType.BLOCK,
          variant: 'html',
          blockType: 'basic',
          properties: {},
        },
        {
          id: 'compile_ast:21',
          type: ASTNodeType.BLOCK,
          variant: 'html',
          blockType: 'basic',
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
      await renderer.render(context)

      // Assert
      const parentCallArgs = mockRender.mock.calls[2][0]
      expect(parentCallArgs.items).toHaveLength(2)
      expect(parentCallArgs.items[0].html).toBe('<div>Block</div>')
    })

    it('should filter out hidden nested blocks from arrays', async () => {
      // Arrange
      const mockRender = jest.fn().mockResolvedValue('<div>Block</div>')
      mockComponentRegistry.get.mockReturnValue({
        variant: 'html',
        render: mockRender,
      })

      const visibleBlock: Evaluated<BlockASTNode> = {
        id: 'compile_ast:20',
        type: ASTNodeType.BLOCK,
        variant: 'html',
        blockType: 'basic',
        properties: {},
      }

      const hiddenBlock: Evaluated<BlockASTNode> = {
        id: 'compile_ast:21',
        type: ASTNodeType.BLOCK,
        variant: 'html',
        blockType: 'basic',
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
      await renderer.render(context)

      // Assert
      const parentCallArgs = mockRender.mock.calls[1][0]
      expect(parentCallArgs.items).toHaveLength(1)
      expect(parentCallArgs.items[0].html).toBe('<div>Block</div>')
    })

    it('should recursively transform nested objects', async () => {
      // Arrange
      const mockRender = jest.fn().mockResolvedValue('<span>Hint</span>')
      mockComponentRegistry.get.mockReturnValue({
        variant: 'text-input',
        render: mockRender,
      })

      const nestedBlock: Evaluated<BlockASTNode> = {
        id: 'compile_ast:30',
        type: ASTNodeType.BLOCK,
        variant: 'text-input',
        blockType: 'basic',
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
      await renderer.render(context)

      // Assert
      const parentCallArgs = mockRender.mock.calls[1][0]
      expect(parentCallArgs.config.hint.content.html).toBe('<span>Hint</span>')
    })

    it('should preserve null and undefined values', async () => {
      // Arrange
      const mockRender = jest.fn().mockResolvedValue('<input />')
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
      await renderer.render(context)

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

    it('should preserve primitive values unchanged', async () => {
      // Arrange
      const mockRender = jest.fn().mockResolvedValue('<input />')
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
      await renderer.render(context)

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
    it('should handle empty blocks array', async () => {
      // Arrange
      const context = createRenderContext({ blocks: [] })

      // Act
      await renderer.render(context)

      // Assert
      const templateContext = mockNunjucksEnv.render.mock.calls[0][1] as TemplateContext
      expect(templateContext.blocks).toEqual([])
    })

    it('should handle empty ancestors array', async () => {
      // Arrange
      const context = createRenderContext({ ancestors: [] })

      // Act
      await renderer.render(context)

      // Assert
      expect(mockNunjucksEnv.render).toHaveBeenCalledWith('form-step.njk', expect.any(Object), expect.any(Function))
    })

    it('should return empty string when Nunjucks returns null result', async () => {
      // Arrange
      mockNunjucksEnv.render.mockImplementation((template, data, callback) => {
        callback(null, null)
      })

      const context = createRenderContext()

      // Act
      const result = await renderer.render(context)

      // Assert
      expect(result).toBe('')
    })
  })
})
