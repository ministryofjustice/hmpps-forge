import type { NodeId, RenderContext } from '@ministryofjustice/hmpps-forge/core/framework'
import { runInNewContext } from 'node:vm'
import nunjucks from 'nunjucks'
import BrowserPrecompiledLoader from './BrowserPrecompiledLoader'
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

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('constructor()', () => {
    it('should preserve loader methods when an environment has custom loaders', () => {
      // Arrange
      const loader = new nunjucks.Loader()
      const isRelative = vi.spyOn(loader, 'isRelative')
      const resolve = vi.spyOn(loader, 'resolve')
      const environment = { ...templateEnv, loaders: [loader], invalidateCache: vi.fn() }

      Object.freeze(loader)

      // Act
      const renderer = new NunjucksBrowserRenderer({ templateEnv: environment })

      // Assert
      expect(renderer).toBeDefined()
      expect(environment.loaders).toEqual([loader])
      expect(isRelative).not.toHaveBeenCalled()
      expect(resolve).not.toHaveBeenCalled()
      expect(environment.invalidateCache).not.toHaveBeenCalled()
    })

    it('should configure relative template loading when standard precompiled templates are present', () => {
      // Arrange
      const templates: Record<string, object> = {}
      const sources = {
        'app/page.njk': '{% include "./partial.njk" %}',
        'app/partial.njk': '{{ greeting }} {{ name | shout }}',
      }

      Object.entries(sources).forEach(([name, source]) => {
        runInNewContext(nunjucks.precompileString(source, { name }), { window: { nunjucksPrecompiled: templates } })
      })
      vi.stubGlobal('window', { nunjucksPrecompiled: templates })

      const customLoader = new BrowserPrecompiledLoader({})
      const environment: nunjucks.Environment & { loaders?: nunjucks.Loader[] } = new nunjucks.Environment([
        customLoader,
      ])

      environment.addGlobal('greeting', 'Hello')
      environment.addFilter('shout', (value: string) => value.toUpperCase())

      // Act
      const renderer = new NunjucksBrowserRenderer({ templateEnv: environment, defaultTemplate: 'app/page' })
      const html = renderer.assemblePage(createRenderContext(), [], { name: 'Ada <Lovelace>' })

      // Assert
      expect(html).toBe('Hello ADA &lt;LOVELACE&gt;')
      expect(renderer.getAdapterDependencies().nunjucksEnv).toBe(environment)
      expect(environment.render('app/page.njk', { name: 'Ada <Lovelace>' })).toBe('Hello ADA &lt;LOVELACE&gt;')
      expect(environment.loaders?.[0]).toBeInstanceOf(BrowserPrecompiledLoader)
      expect(environment.loaders?.[1]).toBe(customLoader)
    })
  })

  describe('getAdapterDependencies()', () => {
    it('should supply the page environment when component rendering requests its dependencies', () => {
      // Arrange
      const renderer = new NunjucksBrowserRenderer({ templateEnv })

      // Act
      const dependencies = renderer.getAdapterDependencies()

      // Assert
      expect(dependencies).toEqual({ nunjucksEnv: templateEnv })
      expect(dependencies.nunjucksEnv).toBe(templateEnv)
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
