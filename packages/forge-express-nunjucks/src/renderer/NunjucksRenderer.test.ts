import type { Environment } from 'nunjucks'
import type { RenderContext } from '@ministryofjustice/hmpps-forge/core/framework'
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
