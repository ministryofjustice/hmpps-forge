import nunjucks from 'nunjucks'

import { BlockType, StructureType } from '@ministryofjustice/hmpps-forge/core/authoring'
import { BlockDefinition, EvaluatedBlock } from '@ministryofjustice/hmpps-forge/core/components'
import { RenderContext } from '@ministryofjustice/hmpps-forge/core/framework'
import NunjucksRenderer from './NunjucksRenderer'
import { TemplateContext } from './types'

describe('NunjucksRenderer', () => {
  let renderer: NunjucksRenderer
  let mockNunjucksEnv: Mocked<nunjucks.Environment>
  let mockTemplate: { render: Mock }

  beforeEach(() => {
    mockTemplate = { render: vi.fn().mockReturnValue('<html>rendered</html>') }

    mockNunjucksEnv = {
      getTemplate: vi.fn().mockReturnValue(mockTemplate),
    } as unknown as Mocked<nunjucks.Environment>

    renderer = new NunjucksRenderer({
      nunjucksEnv: mockNunjucksEnv,
    })
  })

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
      blockType: BlockType.FIELD,
      variant: 'text-input',
      errors: [],
    } as unknown as EvaluatedBlock<BlockDefinition>
  }

  describe('assemblePage()', () => {
    it('should render the page template with pre-rendered blocks and return HTML', () => {
      // Arrange
      const context = createRenderContext()

      // Act
      const result = renderer.assemblePage(context, ['<input type="text" />'], {})

      // Assert
      expect(result).toBe('<html>rendered</html>')

      const templateContext = mockTemplate.render.mock.calls[0][0] as TemplateContext

      expect(templateContext.blocks).toEqual(['<input type="text" />'])
    })

    it('should include step, ancestors, route tree, navigation, answers, and data in template context', () => {
      // Arrange
      const context = createRenderContext({
        routeTree: [
          {
            segment: 'journey',
            path: '/journey',
            templatePath: '/journey',
            active: true,
            route: { kind: 'journey', nodeId: 'compile_ast:1', title: 'Test Journey' },
            children: [],
          },
        ],
        answers: { name: 'Ada' },
        data: { source: 'test' },
      })

      // Act
      renderer.assemblePage(context, [], {})

      // Assert
      const templateContext = mockTemplate.render.mock.calls[0][0] as TemplateContext

      expect(templateContext.step).toEqual(context.step)
      expect(templateContext.ancestors).toEqual(context.ancestors)
      expect(templateContext.routeTree).toEqual(context.routeTree)
      expect(templateContext.answers).toEqual({ name: 'Ada' })
      expect(templateContext.data).toEqual({ source: 'test' })
      expect(templateContext.navigation).toEqual([
        {
          type: 'journey',
          title: 'Test Journey',
          description: undefined,
          path: '/journey',
          active: true,
          metadata: undefined,
          children: [],
        },
      ])
    })

    it('should merge request state into the template context', () => {
      // Arrange
      const context = createRenderContext()

      // Act
      renderer.assemblePage(context, [], { csrfToken: 'abc123', applicationName: 'My App' })

      // Assert
      const templateContext = mockTemplate.render.mock.calls[0][0] as TemplateContext

      expect(templateContext.csrfToken).toBe('abc123')
      expect(templateContext.applicationName).toBe('My App')
    })

    it('should merge view locals with step overriding ancestors and ancestors overriding request state', () => {
      // Arrange
      const context = createRenderContext({
        step: { path: '/step', title: 'Test', view: { locals: { phase: 'step' } } },
        ancestors: [
          { code: 'root', path: '/root', view: { locals: { phase: 'root', theme: 'dark' } } },
          { code: 'parent', path: '/parent', view: { locals: { theme: 'light' } } },
        ],
      })

      // Act
      renderer.assemblePage(context, [], { phase: 'request', source: 'state' })

      // Assert
      const templateContext = mockTemplate.render.mock.calls[0][0] as TemplateContext

      expect(templateContext.phase).toBe('step')
      expect(templateContext.theme).toBe('light')
      expect(templateContext.source).toBe('state')
    })

    it('should use step template when specified', () => {
      // Arrange
      const context = createRenderContext({
        step: { path: '/step', title: 'Test', view: { template: 'custom-step.njk' } },
      })

      // Act
      renderer.assemblePage(context, [], {})

      // Assert
      expect(mockNunjucksEnv.getTemplate).toHaveBeenCalledWith('custom-step.njk')
    })

    it('should fall back through ancestors to the default template', () => {
      // Arrange
      const withParentTemplate = createRenderContext({
        ancestors: [
          { code: 'root', path: '/root', view: { template: 'root-template.njk' } },
          { code: 'parent', path: '/parent', view: { template: 'parent-template.njk' } },
        ],
      })
      const withRootTemplate = createRenderContext({
        ancestors: [
          { code: 'root', path: '/root', view: { template: 'root-template.njk' } },
          { code: 'parent', path: '/parent' },
        ],
      })
      const withNoTemplate = createRenderContext({ ancestors: [] })

      // Act
      renderer.assemblePage(withParentTemplate, [], {})
      renderer.assemblePage(withRootTemplate, [], {})
      renderer.assemblePage(withNoTemplate, [], {})

      // Assert
      expect(mockNunjucksEnv.getTemplate).toHaveBeenNthCalledWith(1, 'parent-template.njk')
      expect(mockNunjucksEnv.getTemplate).toHaveBeenNthCalledWith(2, 'root-template.njk')
      expect(mockNunjucksEnv.getTemplate).toHaveBeenNthCalledWith(3, 'form-step.njk')
    })

    it('should append the .njk extension when not present', () => {
      // Arrange
      const context = createRenderContext({
        step: { path: '/step', title: 'Test', view: { template: 'custom-template' } },
      })

      // Act
      renderer.assemblePage(context, [], {})

      // Assert
      expect(mockNunjucksEnv.getTemplate).toHaveBeenCalledWith('custom-template.njk')
    })

    it('should throw a wrapped error when Nunjucks rendering fails', () => {
      // Arrange
      mockTemplate.render.mockImplementation(() => {
        throw new Error('Template syntax error')
      })

      const context = createRenderContext()

      // Act & Assert
      expect(() => renderer.assemblePage(context, [], {})).toThrow('Template syntax error')
    })

    it('should return an empty string when Nunjucks returns an empty string', () => {
      // Arrange
      mockTemplate.render.mockReturnValue('')

      const context = createRenderContext()

      // Act
      const result = renderer.assemblePage(context, [], {})

      // Assert
      expect(result).toBe('')
    })
  })

  describe('renderBlock()', () => {
    it('should render via the component with the cached env proxy', () => {
      // Arrange
      const mockRender = vi.fn().mockReturnValue('<input />')
      const entry = { variant: 'text-input', render: mockRender }
      const block = createEvaluatedBlock()

      // Act
      const result = renderer.renderBlock(entry, block)

      // Assert
      expect(result).toBe('<input />')
      expect(mockRender).toHaveBeenCalledWith(block, expect.objectContaining({ render: expect.any(Function) }))
    })

    it('should throw when the component does not return a string', () => {
      // Arrange
      const entry = { variant: 'text-input', render: vi.fn().mockReturnValue({ not: 'a string' }) }

      // Act & Assert
      expect(() => renderer.renderBlock(entry, createEvaluatedBlock())).toThrow(
        'Component variant "text-input" must render an HTML string for the Nunjucks renderer.',
      )
    })

    it('should wrap component render errors preserving the message', () => {
      // Arrange
      const entry = {
        variant: 'text-input',
        render: vi.fn().mockImplementation(() => {
          throw new Error('Component exploded')
        }),
      }

      // Act & Assert
      expect(() => renderer.renderBlock(entry, createEvaluatedBlock())).toThrow('Component exploded')
    })
  })

  describe('wrapNestedBlock()', () => {
    it('should wrap a rendered child as block metadata plus HTML', () => {
      // Arrange
      const block = {
        type: StructureType.BLOCK,
        blockType: BlockType.BASIC,
        variant: 'fieldset',
        content: 'Nested',
      } as unknown as BlockDefinition

      // Act
      const wrapped = renderer.wrapNestedBlock(block, '<div>Nested content</div>')

      // Assert
      expect(wrapped).toEqual({ block, html: '<div>Nested content</div>' })
    })
  })
})
