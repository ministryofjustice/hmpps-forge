import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { Forge } from '@ministryofjustice/hmpps-forge/core'
import { journey, step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { HtmlBlock } from '@ministryofjustice/hmpps-forge/core/components'
import { StaticSiteGenerator } from './StaticSiteGenerator'
import type { StaticRenderFunction } from './types'

const silentLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
} as unknown as Console

function contentJourney(code: string, steps: ReturnType<typeof step>[]) {
  return journey({
    code,
    path: `/${code}`,
    title: code,
    reachability: { disableReachabilityChecks: true },
    steps,
  })
}

describe('StaticSiteGenerator', () => {
  let outputDir: string

  beforeEach(() => {
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-static-'))
  })

  afterEach(() => {
    fs.rmSync(outputDir, { recursive: true, force: true })
  })

  describe('build()', () => {
    it('should generate a page for each step in the journey', async () => {
      // Arrange
      const testJourney = contentJourney('test-site', [
        step({
          code: 'home',
          path: '/home',
          title: 'Home',
          blocks: [HtmlBlock({ content: '<h1>Welcome</h1>' })],
        }),
        step({
          code: 'about',
          path: '/about',
          title: 'About',
          blocks: [HtmlBlock({ content: '<h1>About Us</h1>' })],
        }),
      ])

      const forge = new Forge({ logger: silentLogger }).registerPackage({ journey: testJourney })

      const render = vi.fn<StaticRenderFunction>(context => {
        return `<html><body><h1>${context.step.title}</h1></body></html>`
      })

      const generator = new StaticSiteGenerator({ forge, outputDir, render, logger: silentLogger })

      // Act
      const result = await generator.build()

      // Assert
      expect(result.pages).toHaveLength(2)
      expect(render).toHaveBeenCalledTimes(2)

      const homePath = path.join(outputDir, 'test-site/home/index.html')
      const aboutPath = path.join(outputDir, 'test-site/about/index.html')

      expect(fs.existsSync(homePath)).toBe(true)
      expect(fs.existsSync(aboutPath)).toBe(true)
      expect(fs.readFileSync(homePath, 'utf-8')).toContain('Home')
      expect(fs.readFileSync(aboutPath, 'utf-8')).toContain('About')
    })

    it('should skip dynamic routes with path parameters', async () => {
      // Arrange
      const testJourney = journey({
        code: 'dynamic-site',
        path: '/site/:siteId',
        title: 'Dynamic Site',
        reachability: { disableReachabilityChecks: true },
        steps: [
          step({
            code: 'detail',
            path: '/detail',
            title: 'Detail',
            blocks: [HtmlBlock({ content: '<p>Detail page</p>' })],
          }),
        ],
      })

      const forge = new Forge({ logger: silentLogger }).registerPackage({ journey: testJourney })
      const render = vi.fn<StaticRenderFunction>(() => '<html></html>')

      const generator = new StaticSiteGenerator({ forge, outputDir, render, logger: silentLogger })

      // Act
      const result = await generator.build()

      // Assert
      expect(result.pages).toHaveLength(0)
      expect(result.skipped.some(s => s.reason.includes('dynamic route'))).toBe(true)
      expect(render).not.toHaveBeenCalled()
    })

    it('should pass render context with blocks to the render function', async () => {
      // Arrange
      const testJourney = contentJourney('content-site', [
        step({
          code: 'page',
          path: '/page',
          title: 'Content Page',
          blocks: [HtmlBlock({ content: '<p>First block</p>' }), HtmlBlock({ content: '<p>Second block</p>' })],
        }),
      ])

      const forge = new Forge({ logger: silentLogger }).registerPackage({ journey: testJourney })
      const render = vi.fn<StaticRenderFunction>(() => '<html></html>')

      const generator = new StaticSiteGenerator({ forge, outputDir, render, logger: silentLogger })

      // Act
      await generator.build()

      // Assert
      expect(render).toHaveBeenCalledTimes(1)

      const [context, componentRegistry, staticContext] = render.mock.calls[0]

      expect(context.step.title).toBe('Content Page')
      expect(context.blocks).toHaveLength(2)
      expect(context.blocks[0].variant).toBe('html')
      expect(componentRegistry).toBeDefined()
      expect(staticContext.basePath).toBe('../..')
    })

    it('should support async render functions', async () => {
      // Arrange
      const testJourney = contentJourney('async-site', [
        step({
          code: 'page',
          path: '/page',
          title: 'Async Page',
          blocks: [HtmlBlock({ content: '<p>Async content</p>' })],
        }),
      ])

      const forge = new Forge({ logger: silentLogger }).registerPackage({ journey: testJourney })

      const render = vi.fn<StaticRenderFunction>(async context => {
        return `<html><body>${context.step.title}</body></html>`
      })

      const generator = new StaticSiteGenerator({ forge, outputDir, render, logger: silentLogger })

      // Act
      const result = await generator.build()

      // Assert
      expect(result.pages).toHaveLength(1)

      const content = fs.readFileSync(path.join(outputDir, 'async-site/page/index.html'), 'utf-8')

      expect(content).toContain('Async Page')
    })

    it('should return build result with page metadata', async () => {
      // Arrange
      const testJourney = contentJourney('meta-site', [
        step({
          code: 'page',
          path: '/page',
          title: 'Meta Page',
          blocks: [HtmlBlock({ content: '<p>Content</p>' })],
        }),
      ])

      const forge = new Forge({ logger: silentLogger }).registerPackage({ journey: testJourney })
      const render: StaticRenderFunction = () => '<html></html>'

      const generator = new StaticSiteGenerator({ forge, outputDir, render, logger: silentLogger })

      // Act
      const result = await generator.build()

      // Assert
      expect(result.pages).toHaveLength(1)
      expect(result.pages[0].relativePath).toBe(path.join('meta-site/page', 'index.html'))
      expect(result.pages[0].outputPath).toBe(path.join(outputDir, 'meta-site/page', 'index.html'))
      expect(result.pages[0].route.templatePath).toBe('/meta-site/page')
    })
  })
})
