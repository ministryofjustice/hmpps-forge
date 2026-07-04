import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { Forge } from '@ministryofjustice/hmpps-forge/core'
import { journey, step, access, redirect } from '@ministryofjustice/hmpps-forge/core/authoring'
import { HtmlBlock } from '@ministryofjustice/hmpps-forge/core/components'
import { StaticSiteGenerator } from './StaticSiteGenerator'
import { StaticHtmlRenderer } from './StaticHtmlRenderer'
import type { StaticPageRenderer } from './StaticHtmlRenderer'

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
      const page = vi.fn<StaticPageRenderer>(
        ({ context }) => `<html><body><h1>${context.step.title}</h1></body></html>`,
      )
      const renderer = new StaticHtmlRenderer({ page })

      const generator = new StaticSiteGenerator({ forge, outputDir, renderer, logger: silentLogger })

      // Act
      const result = await generator.build()

      // Assert
      expect(result.pages).toHaveLength(2)
      expect(page).toHaveBeenCalledTimes(2)

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
      const page = vi.fn<StaticPageRenderer>(() => '<html></html>')
      const renderer = new StaticHtmlRenderer({ page })

      const generator = new StaticSiteGenerator({ forge, outputDir, renderer, logger: silentLogger })

      // Act
      const result = await generator.build()

      // Assert
      expect(result.pages).toHaveLength(0)
      expect(result.skipped.some(s => s.reason.includes('dynamic route'))).toBe(true)
      expect(page).not.toHaveBeenCalled()
    })

    it('should pass the render context and blocks to the page function', async () => {
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
      const page = vi.fn<StaticPageRenderer>(() => '<html></html>')
      const renderer = new StaticHtmlRenderer({ page })

      const generator = new StaticSiteGenerator({ forge, outputDir, renderer, logger: silentLogger })

      // Act
      await generator.build()

      // Assert
      expect(page).toHaveBeenCalledTimes(1)

      const [{ context, blocks }] = page.mock.calls[0]

      expect(context.step.title).toBe('Content Page')
      expect(context.blocks).toHaveLength(2)
      expect(blocks).toHaveLength(2)
      expect(blocks[0]).toContain('First block')
    })

    it('should pass a two-segment basePath to the page function for a nested step', async () => {
      // Arrange
      const testJourney = contentJourney('deep-site', [
        step({
          code: 'page',
          path: '/page',
          title: 'Deep Page',
          blocks: [HtmlBlock({ content: '<p>Deep</p>' })],
        }),
      ])

      const forge = new Forge({ logger: silentLogger }).registerPackage({ journey: testJourney })
      const page = vi.fn<StaticPageRenderer>(() => '<html></html>')
      const renderer = new StaticHtmlRenderer({ page })

      const generator = new StaticSiteGenerator({ forge, outputDir, renderer, logger: silentLogger })

      // Act
      await generator.build()

      // Assert
      const [{ basePath }] = page.mock.calls[0]

      expect(basePath).toBe('../..')
    })

    it('should pass a single-segment basePath to the page function for a top-level step', async () => {
      // Arrange
      const testJourney = journey({
        code: 'root-site',
        path: '/',
        title: 'Root Site',
        reachability: { disableReachabilityChecks: true },
        steps: [
          step({
            code: 'page',
            path: '/page',
            title: 'Top Page',
            blocks: [HtmlBlock({ content: '<p>Top</p>' })],
          }),
        ],
      })

      const forge = new Forge({ logger: silentLogger }).registerPackage({ journey: testJourney })
      const page = vi.fn<StaticPageRenderer>(() => '<html></html>')
      const renderer = new StaticHtmlRenderer({ page })

      const generator = new StaticSiteGenerator({ forge, outputDir, renderer, logger: silentLogger })

      // Act
      await generator.build()

      // Assert
      expect(page).toHaveBeenCalledTimes(1)

      const [{ basePath }] = page.mock.calls[0]

      expect(basePath).toBe('..')
    })

    it('should use the default renderer when no renderer is provided', async () => {
      // Arrange
      const testJourney = contentJourney('default-site', [
        step({
          code: 'page',
          path: '/page',
          title: 'Default Page',
          blocks: [HtmlBlock({ content: '<p>Default content</p>' })],
        }),
      ])

      const forge = new Forge({ logger: silentLogger }).registerPackage({ journey: testJourney })

      const generator = new StaticSiteGenerator({ forge, outputDir, logger: silentLogger })

      // Act
      const result = await generator.build()

      // Assert
      expect(result.pages).toHaveLength(1)

      const html = fs.readFileSync(path.join(outputDir, 'default-site/page/index.html'), 'utf-8')

      expect(html).toContain('<!DOCTYPE html>')
      expect(html).toContain('<h1>Default Page</h1>')
      expect(html).toContain('Default content')
    })

    it('should skip a route that produces a non-render outcome', async () => {
      // Arrange
      const testJourney = contentJourney('redirect-site', [
        step({
          code: 'home',
          path: '/home',
          title: 'Home',
          blocks: [HtmlBlock({ content: '<p>Home</p>' })],
        }),
        step({
          code: 'away',
          path: '/away',
          title: 'Away',
          onAccess: [access({ next: [redirect({ goto: '/redirect-site/home' })] })],
          blocks: [HtmlBlock({ content: '<p>Away</p>' })],
        }),
      ])

      const forge = new Forge({ logger: silentLogger }).registerPackage({ journey: testJourney })

      const generator = new StaticSiteGenerator({ forge, outputDir, logger: silentLogger })

      // Act
      const result = await generator.build()

      // Assert
      expect(result.pages).toHaveLength(1)
      expect(result.skipped.some(s => s.reason === 'evaluation did not produce a render outcome')).toBe(true)
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

      const generator = new StaticSiteGenerator({ forge, outputDir, logger: silentLogger })

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
