import nunjucks from 'nunjucks'

import { BlockType, StructureType } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  ComponentRegistry,
  RenderContext,
  Evaluated,
  BlockASTNode,
  ASTNodeType,
} from '@ministryofjustice/hmpps-forge/core/framework'
import TemplateRenderer from './TemplateRenderer'
import { TemplateContext } from './types'

describe('TemplateRenderer', () => {
  let renderer: TemplateRenderer
  let mockNunjucksEnv: Mocked<nunjucks.Environment>
  let mockComponentRegistry: Mocked<ComponentRegistry>
  let mockTemplate: { render: Mock }

  beforeEach(() => {
    mockTemplate = { render: vi.fn().mockReturnValue('<html>rendered</html>') }

    mockNunjucksEnv = {
      getTemplate: vi.fn().mockReturnValue(mockTemplate),
    } as unknown as Mocked<nunjucks.Environment>

    mockComponentRegistry = {
      get: vi.fn(),
      getAll: vi.fn().mockReturnValue(new Map()),
    } as unknown as Mocked<ComponentRegistry>

    renderer = new TemplateRenderer({
      nunjucksEnv: mockNunjucksEnv,
    })
  })

  function render(context: RenderContext, locals: Record<string, unknown> = {}): string {
    return renderer.render(context, locals, mockComponentRegistry)
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
        render: vi.fn().mockReturnValue('<input type="text" />'),
      })

      const context = createRenderContext({
        blocks: [createMockBlock()],
      })

      // Act
      const result = render(context)

      // Assert
      expect(result).toBe('<html>rendered</html>')
      expect(mockTemplate.render).toHaveBeenCalled()
    })

    it('should pass rendered blocks to template context', () => {
      // Arrange
      mockComponentRegistry.get.mockReturnValue({
        variant: 'text-input',
        render: vi.fn().mockReturnValue('<input type="text" />'),
      })

      const context = createRenderContext({
        blocks: [createMockBlock()],
      })

      // Act
      render(context)

      // Assert
      const templateContext = mockTemplate.render.mock.calls[0][0] as TemplateContext
      expect(templateContext.blocks).toEqual(['<input type="text" />'])
    })

    it('should include step, ancestors, route tree, answers, and data in template context', () => {
      // Arrange
      const context = createRenderContext({
        answers: { email: 'test@example.com' },
        data: { userId: '123' },
      })

      // Act
      render(context)

      // Assert
      const templateContext = mockTemplate.render.mock.calls[0][0] as TemplateContext
      expect(templateContext.step).toEqual({ path: '/step', title: 'Test Step' })
      expect(templateContext.ancestors).toEqual([{ code: 'test-journey', path: '/journey', title: 'Test Journey' }])
      expect(templateContext.routeTree).toEqual([])
      expect(templateContext.navigation).toEqual([])
      expect(templateContext.answers).toEqual({ email: 'test@example.com' })
      expect(templateContext.data).toEqual({ userId: '123' })
    })

    it('should expose old navigation shape from route tree in template context', () => {
      // Arrange
      const context = createRenderContext({
        routeTree: [
          {
            segment: 'apply',
            path: '/apply',
            templatePath: '/apply',
            active: true,
            metadata: { navGroup: 'Top' },
            route: {
              kind: 'journey',
              nodeId: 'compile_ast:1',
              title: 'Apply',
              description: 'Application journey',
              metadata: { navGroup: 'Top' },
            },
            children: [
              {
                segment: 'personal',
                path: '/apply/personal',
                templatePath: '/apply/personal',
                active: true,
                children: [
                  {
                    segment: 'name',
                    path: '/apply/personal/name',
                    templatePath: '/apply/personal/name',
                    active: true,
                    metadata: { hiddenFromNav: false },
                    route: {
                      kind: 'step',
                      nodeId: 'compile_ast:2',
                      title: 'Name',
                      metadata: { hiddenFromNav: false },
                    },
                    children: [],
                  },
                ],
              },
            ],
          },
        ],
      })

      // Act
      render(context)

      // Assert
      const templateContext = mockTemplate.render.mock.calls[0][0] as TemplateContext
      expect(templateContext.navigation).toEqual([
        {
          type: 'journey',
          title: 'Apply',
          description: 'Application journey',
          path: '/apply',
          active: true,
          metadata: { navGroup: 'Top' },
          children: [
            {
              type: 'step',
              title: 'Name',
              description: undefined,
              path: '/apply/personal/name',
              active: true,
              metadata: { hiddenFromNav: false },
              children: [],
            },
          ],
        },
      ])
    })

    it('should merge provided locals into template context', () => {
      // Arrange
      const context = createRenderContext()
      const locals = { csrfToken: 'abc123', applicationName: 'My App' }

      // Act
      render(context, locals)

      // Assert
      const templateContext = mockTemplate.render.mock.calls[0][0] as TemplateContext
      expect(templateContext.csrfToken).toBe('abc123')
      expect(templateContext.applicationName).toBe('My App')
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
      render(context)

      // Assert
      const templateContext = mockTemplate.render.mock.calls[0][0] as TemplateContext
      expect(templateContext.blocks).toHaveLength(1)
    })

    it('should throw error when Nunjucks render fails', () => {
      // Arrange
      mockTemplate.render.mockImplementation(() => {
        throw new Error('Template syntax error')
      })

      const context = createRenderContext()

      // Act & Assert
      expect(() => render(context)).toThrow('Template syntax error')
    })
  })

  describe('resolveTemplate()', () => {
    it('should use step template when specified', () => {
      // Arrange
      const context = createRenderContext({
        step: { path: '/step', title: 'Test', view: { template: 'custom-step.njk' } },
      })

      // Act
      render(context)

      // Assert
      expect(mockNunjucksEnv.getTemplate).toHaveBeenCalledWith('custom-step.njk')
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
      render(context)

      // Assert
      expect(mockNunjucksEnv.getTemplate).toHaveBeenCalledWith('parent-template.njk')
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
      render(context)

      // Assert
      expect(mockNunjucksEnv.getTemplate).toHaveBeenCalledWith('root-template.njk')
    })

    it('should use default template when no template specified anywhere', () => {
      // Arrange
      const context = createRenderContext({
        step: { path: '/step', title: 'Test' },
        ancestors: [{ code: 'journey', path: '/journey', title: 'Journey' }],
      })

      // Act
      render(context)

      // Assert
      expect(mockNunjucksEnv.getTemplate).toHaveBeenCalledWith('form-step.njk')
    })

    it('should append .njk extension when not present', () => {
      // Arrange
      const context = createRenderContext({
        step: { path: '/step', title: 'Test', view: { template: 'custom-template' } },
      })

      // Act
      render(context)

      // Assert
      expect(mockNunjucksEnv.getTemplate).toHaveBeenCalledWith('custom-template.njk')
    })

    it('should not double-append .njk extension', () => {
      // Arrange
      const context = createRenderContext({
        step: { path: '/step', title: 'Test', view: { template: 'custom-template.njk' } },
      })

      // Act
      render(context)

      // Assert
      expect(mockNunjucksEnv.getTemplate).toHaveBeenCalledWith('custom-template.njk')
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
      render(context)

      // Assert
      const templateContext = mockTemplate.render.mock.calls[0][0] as TemplateContext
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
      render(context)

      // Assert
      const templateContext = mockTemplate.render.mock.calls[0][0] as TemplateContext
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
      render(context)

      // Assert
      const templateContext = mockTemplate.render.mock.calls[0][0] as TemplateContext
      expect(templateContext.parentVar).toBe('value')
    })

    it('should handle ancestors with view but no locals', () => {
      // Arrange
      const context = createRenderContext({
        ancestors: [{ code: 'journey', path: '/journey', title: 'Journey', view: { template: 'custom.njk' } }],
      })

      // Act
      render(context)

      // Assert
      const templateContext = mockTemplate.render.mock.calls[0][0] as TemplateContext
      expect(templateContext.step).toBeDefined()
    })
  })

  describe('renderBlock()', () => {
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
      expect(() => render(context)).toThrow(
        'Component variant "unknown-component" not found in registry. Available variants: html, radios',
      )
    })

    it('should call component render with evaluated block', () => {
      // Arrange
      const mockRender = vi.fn().mockReturnValue('<input />')
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
      render(context)

      // Assert
      expect(mockRender).toHaveBeenCalledWith(
        expect.objectContaining({
          type: StructureType.BLOCK,
          variant: 'text-input',
          label: 'Email',
          name: 'email',
          errors: [],
        }),
        expect.anything(),
      )
    })
  })

  describe('extractErrorsFromValidations()', () => {
    it('should extract failed validations as errors when showValidationFailures is true', () => {
      // Arrange
      const mockRender = vi.fn().mockReturnValue('<input />')
      mockComponentRegistry.get.mockReturnValue({
        variant: 'text-input',
        render: mockRender,
      })

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
      render(context)

      // Assert
      expect(mockRender).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: [
            { message: 'Email is required', details: { field: 'email' } },
            { message: 'Email format is invalid', details: undefined },
          ],
        }),
        expect.anything(),
      )
    })

    it('should not include errors when showValidationFailures is false', () => {
      // Arrange
      const mockRender = vi.fn().mockReturnValue('<input />')
      mockComponentRegistry.get.mockReturnValue({
        variant: 'text-input',
        render: mockRender,
      })

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
      render(context)

      // Assert
      expect(mockRender).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: [],
        }),
        expect.anything(),
      )
    })

    it('should handle validWhen property that is not an array', () => {
      // Arrange
      const mockRender = vi.fn().mockReturnValue('<input />')
      mockComponentRegistry.get.mockReturnValue({
        variant: 'text-input',
        render: mockRender,
      })

      const context = createRenderContext({
        showValidationFailures: true,
        blocks: [
          createMockBlock({
            properties: { validWhen: 'not-an-array' },
          }),
        ],
      })

      // Act
      render(context)

      // Assert
      expect(mockRender).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: [],
        }),
        expect.anything(),
      )
    })
  })

  describe('transformPropertiesWithRenderedBlocks()', () => {
    it('should render nested blocks to RenderedBlock format', () => {
      // Arrange
      const mockRender = vi.fn().mockReturnValue('<div>Nested content</div>')
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
      render(context)

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
      const mockRender = vi.fn().mockReturnValue('<div>Block</div>')
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
      render(context)

      // Assert
      const parentCallArgs = mockRender.mock.calls[2][0]
      expect(parentCallArgs.items).toHaveLength(2)
      expect(parentCallArgs.items[0].html).toBe('<div>Block</div>')
    })

    it('should filter out non-visible nested blocks from arrays', () => {
      // Arrange
      const mockRender = vi.fn().mockReturnValue('<div>Block</div>')
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
        properties: { visibleWhen: false },
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
      render(context)

      // Assert
      const parentCallArgs = mockRender.mock.calls[1][0]
      expect(parentCallArgs.items).toHaveLength(1)
      expect(parentCallArgs.items[0].html).toBe('<div>Block</div>')
    })

    it('should recursively transform nested objects', () => {
      // Arrange
      const mockRender = vi.fn().mockReturnValue('<span>Hint</span>')
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
      render(context)

      // Assert
      const parentCallArgs = mockRender.mock.calls[1][0]
      expect(parentCallArgs.config.hint.content.html).toBe('<span>Hint</span>')
    })

    it('should preserve null and undefined values', () => {
      // Arrange
      const mockRender = vi.fn().mockReturnValue('<input />')
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
      render(context)

      // Assert
      expect(mockRender).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'Test',
          hint: null,
          description: undefined,
        }),
        expect.anything(),
      )
    })

    it('should preserve primitive values unchanged', () => {
      // Arrange
      const mockRender = vi.fn().mockReturnValue('<input />')
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
      render(context)

      // Assert
      expect(mockRender).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'Test Label',
          maxLength: 100,
          required: true,
        }),
        expect.anything(),
      )
    })
  })

  describe('render() edge cases', () => {
    it('should handle empty blocks array', () => {
      // Arrange
      const context = createRenderContext({ blocks: [] })

      // Act
      render(context)

      // Assert
      const templateContext = mockTemplate.render.mock.calls[0][0] as TemplateContext
      expect(templateContext.blocks).toEqual([])
    })

    it('should handle empty ancestors array', () => {
      // Arrange
      const context = createRenderContext({ ancestors: [] })

      // Act
      render(context)

      // Assert
      expect(mockNunjucksEnv.getTemplate).toHaveBeenCalledWith('form-step.njk')
    })

    it('should return empty string when Nunjucks returns empty string', () => {
      // Arrange
      mockTemplate.render.mockReturnValue('')

      const context = createRenderContext()

      // Act
      const result = render(context)

      // Assert
      expect(result).toBe('')
    })
  })
})
