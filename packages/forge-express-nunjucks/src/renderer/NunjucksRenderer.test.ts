import type { Environment } from 'nunjucks'
import { BlockType } from '@ministryofjustice/hmpps-forge/core/authoring'
import type { RenderBlock, RenderContext } from '@ministryofjustice/hmpps-forge/core/framework'
import NunjucksRenderer from './NunjucksRenderer'

function createRenderContext(overrides: Partial<RenderContext> = {}): RenderContext {
  return {
    routeTree: [],
    step: { path: '/step' },
    ancestors: [],
    blocks: [],
    showValidationFailures: false,
    fieldValidationErrors: [],
    domainValidationErrors: [],
    answers: {},
    data: {},
    ...overrides,
  }
}

function createRenderBlock(id: string, properties: Record<string, unknown> = {}): RenderBlock {
  return {
    id: id as RenderBlock['id'],
    variant: 'html',
    blockType: BlockType.BASIC,
    properties,
  }
}

describe('NunjucksRenderer', () => {
  let renderer: NunjucksRenderer
  let getTemplate: ReturnType<typeof vi.fn>
  let renderTemplate: ReturnType<typeof vi.fn>

  beforeEach(() => {
    renderTemplate = vi.fn().mockReturnValue('<html></html>')
    getTemplate = vi.fn().mockReturnValue({ render: renderTemplate })

    const nunjucksEnv = {
      getTemplate,
    } as unknown as Environment

    renderer = new NunjucksRenderer({ nunjucksEnv })
  })

  describe('markBlock()', () => {
    it('should bracket the output with paired comment markers carrying the nodeId', () => {
      // Arrange
      const output = '<input type="text" />'

      // Act
      const marked = renderer.markBlock('compiled:template:90:0', output)

      // Assert
      expect(marked).toBe(
        '<!--forge:compiled:template:90:0--><input type="text" /><!--/forge:compiled:template:90:0-->',
      )
    })
  })

  describe('assemblePage()', () => {
    it('should use the resolved step view without reading ancestor views', () => {
      // Arrange
      const context = createRenderContext({
        step: {
          path: '/step',
          view: {
            template: 'resolved-layout',
            locals: { rootOnly: 'root', shared: 'step' },
          },
        },
        ancestors: [
          {
            code: 'ancestor',
            path: '/ancestor',
            view: {
              template: 'ignored-ancestor-layout',
              locals: { ignoredAncestorOnly: true, shared: 'ancestor' },
            },
          },
        ],
      })

      // Act
      renderer.assemblePage(context, [], {})

      // Assert
      expect(getTemplate).toHaveBeenCalledWith('resolved-layout.njk')
      expect(renderTemplate).toHaveBeenCalledWith(expect.objectContaining({ rootOnly: 'root', shared: 'step' }))
      expect(renderTemplate).toHaveBeenCalledWith(expect.not.objectContaining({ ignoredAncestorOnly: true }))
    })

    it('should pass rendered HTML strings as blocks by default', () => {
      // Arrange
      const context = createRenderContext({
        blocks: [createRenderBlock('compile_ast:1')],
      })

      // Act
      renderer.assemblePage(context, ['<p>Only</p>'], {})

      // Assert
      expect(renderTemplate).toHaveBeenCalledWith(expect.objectContaining({ blocks: ['<p>Only</p>'] }))
    })

    it('should pass rendered HTML strings as blocks when includeBlockData is false', () => {
      // Arrange
      const nunjucksEnv = { getTemplate } as unknown as Environment
      renderer = new NunjucksRenderer({ nunjucksEnv, includeBlockData: false })
      const context = createRenderContext({
        blocks: [createRenderBlock('compile_ast:1')],
      })

      // Act
      renderer.assemblePage(context, ['<p>Only</p>'], {})

      // Assert
      expect(renderTemplate).toHaveBeenCalledWith(expect.objectContaining({ blocks: ['<p>Only</p>'] }))
    })

    it('should pair each rendered string with its render block when includeBlockData is true', () => {
      // Arrange
      const nunjucksEnv = { getTemplate } as unknown as Environment
      renderer = new NunjucksRenderer({ nunjucksEnv, includeBlockData: true })
      const firstBlock = createRenderBlock('compile_ast:1', { metadata: { group: 'main' } })
      const secondBlock = createRenderBlock('compile_ast:2')
      const context = createRenderContext({
        blocks: [firstBlock, secondBlock],
      })

      // Act
      renderer.assemblePage(context, ['<p>First</p>', '<p>Second</p>'], {})

      // Assert
      const templateContext = renderTemplate.mock.calls[0][0]

      expect(templateContext.blocks).toEqual([
        { html: '<p>First</p>', block: firstBlock },
        { html: '<p>Second</p>', block: secondBlock },
      ])
      expect(templateContext.blocks[0].block).toBe(firstBlock)
    })

    it('should keep blocks that rendered empty html paired when includeBlockData is true', () => {
      // Arrange
      const nunjucksEnv = { getTemplate } as unknown as Environment
      renderer = new NunjucksRenderer({ nunjucksEnv, includeBlockData: true })
      const invisibleBlock = createRenderBlock('compile_ast:1')
      const context = createRenderContext({
        blocks: [invisibleBlock],
      })

      // Act
      renderer.assemblePage(context, [''], {})

      // Assert
      expect(renderTemplate).toHaveBeenCalledWith(
        expect.objectContaining({ blocks: [{ html: '', block: invisibleBlock }] }),
      )
    })

    it('should use the configured fallback when the resolved view has no template', () => {
      // Arrange
      const nunjucksEnv = { getTemplate } as unknown as Environment
      renderer = new NunjucksRenderer({ nunjucksEnv, defaultTemplate: 'service-layout' })
      const context = createRenderContext({
        step: { path: '/step', view: { locals: { serviceName: 'Forge' } } },
        ancestors: [
          {
            code: 'ancestor',
            path: '/ancestor',
            view: { template: 'ignored-ancestor-layout' },
          },
        ],
      })

      // Act
      renderer.assemblePage(context, [], {})

      // Assert
      expect(getTemplate).toHaveBeenCalledWith('service-layout.njk')
      expect(renderTemplate).toHaveBeenCalledWith(expect.objectContaining({ serviceName: 'Forge' }))
    })
  })
})
