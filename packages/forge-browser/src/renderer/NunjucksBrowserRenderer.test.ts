import type { NodeId, RenderContext } from '@ministryofjustice/hmpps-forge/core/framework'
import NunjucksBrowserRenderer from './NunjucksBrowserRenderer'
import type { BrowserTemplateEnvironment } from './types'

function createRenderContext(overrides: Partial<RenderContext> = {}): RenderContext {
  return {
    routeTree: [],
    step: { title: 'Start' },
    ancestors: [],
    blocks: [],
    showValidationFailures: false,
    fieldValidationErrors: {},
    domainValidationErrors: [],
    answers: {},
    data: {},
    ...overrides,
  } as unknown as RenderContext
}

describe('NunjucksBrowserRenderer', () => {
  let getTemplate: ReturnType<typeof vi.fn>
  let templateEnv: BrowserTemplateEnvironment

  beforeEach(() => {
    getTemplate = vi.fn().mockImplementation((name: string) => ({
      render: (context?: object) => `${name}:${JSON.stringify((context as { blocks?: unknown })?.blocks)}`,
    }))
    templateEnv = {
      getTemplate: getTemplate as BrowserTemplateEnvironment['getTemplate'],
      render: vi.fn().mockReturnValue(''),
    }
  })

  describe('constructor()', () => {
    it('should preserve loader methods when an environment has custom loaders', () => {
      // Arrange
      const loader = Object.freeze({ isRelative: vi.fn(), resolve: vi.fn() })
      const environment = { ...templateEnv, loaders: [loader] }

      // Act
      const renderer = new NunjucksBrowserRenderer({ templateEnv: environment })

      // Assert
      expect(renderer).toBeDefined()
      expect(environment.loaders).toEqual([loader])
      expect(loader.isRelative).not.toHaveBeenCalled()
      expect(loader.resolve).not.toHaveBeenCalled()
    })
  })

  describe('markBlock()', () => {
    it('should bracket output with forge comment markers', () => {
      // Arrange
      const renderer = new NunjucksBrowserRenderer({ templateEnv })

      // Act
      const marked = renderer.markBlock('node-1' as NodeId, '<p>hi</p>')

      // Assert
      expect(marked).toBe('<!--forge:node-1--><p>hi</p><!--/forge:node-1-->')
    })
  })

  describe('assemblePage()', () => {
    it('should render the default template with the rendered blocks when the step names none', () => {
      // Arrange
      const renderer = new NunjucksBrowserRenderer({ templateEnv })

      // Act
      const page = renderer.assemblePage(createRenderContext(), ['<p>one</p>'], {})

      // Assert
      expect(page).toBe('form-step.njk:["<p>one</p>"]')
    })

    it('should resolve the step template and append the extension when missing', () => {
      // Arrange
      const renderer = new NunjucksBrowserRenderer({ templateEnv })
      const context = createRenderContext({ step: { title: 'Start', view: { template: 'custom-page' } } } as never)

      // Act
      renderer.assemblePage(context, [], {})

      // Assert
      expect(getTemplate).toHaveBeenCalledWith('custom-page.njk')
    })

    it('should pair blocks with their render data when includeBlockData is true', () => {
      // Arrange
      const renderer = new NunjucksBrowserRenderer({ templateEnv, includeBlockData: true })
      const blockData = { id: 'b1', variant: 'demo' }
      const context = createRenderContext({ blocks: [blockData] } as never)

      // Act
      const page = renderer.assemblePage(context, ['<p>one</p>'], {})

      // Assert
      expect(page).toContain('"html":"<p>one</p>"')
      expect(page).toContain('"variant":"demo"')
    })
  })
})
