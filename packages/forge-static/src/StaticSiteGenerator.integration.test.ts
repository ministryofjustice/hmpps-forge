// The developer guide sources live in the sibling examples-app project, which is
// not a workspace dependency of packages/, so they are imported by relative path.
/* eslint-disable import/no-relative-packages */
import { describe, it, expect, beforeEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { Forge } from '@ministryofjustice/hmpps-forge/core'
import { journey, step, createForgePackage, Data } from '@ministryofjustice/hmpps-forge/core/authoring'
import GuideContentStore from '../../../examples-app/server/data/guideContentStore'
import {
  govukMarkdown,
  GovUKMarkdownBlock,
} from '../../../examples-app/server/journeys/forge-developer-guide/components/govukMarkdown'
import {
  tableOfContentsComponent,
  TableOfContents,
} from '../../../examples-app/server/journeys/forge-developer-guide/components/tableOfContents'
import {
  GuideEffectsImplementations,
  loadContent,
} from '../../../examples-app/server/journeys/forge-developer-guide/effects'
import type { GuideDeps } from '../../../examples-app/server/journeys/forge-developer-guide/effects'
import { StaticSiteGenerator } from './StaticSiteGenerator'
import { StaticHtmlRenderer } from './StaticHtmlRenderer'
import type { StaticPageRenderContext } from './StaticHtmlRenderer'
import { bundleAssets } from './bundleAssets'

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

const silentLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
} as unknown as Console

const examplesRoot = path.join(__dirname, '../../../examples-app')
const guideRoot = path.join(examplesRoot, 'server/journeys/forge-developer-guide')

// ---------------------------------------------------------------------------
// Content block — renders markdown with a table of contents slot
// ---------------------------------------------------------------------------

const contentBlock = GovUKMarkdownBlock({
  content: Data('content'),
  slots: {
    toc: [TableOfContents({ headings: Data('headings') })],
  },
})

// ---------------------------------------------------------------------------
// Journey definition — three real pages from the developer guide
// ---------------------------------------------------------------------------

function createGuideJourney() {
  return journey({
    code: 'guide',
    path: '/guide',
    title: 'Forge Guide',
    reachability: { disableReachabilityChecks: true },
    steps: [
      step({
        code: 'get-started',
        path: '/get-started',
        title: 'Get started',
        onAccess: [loadContent('get-started')],
        blocks: [contentBlock],
      }),
      step({
        code: 'why-use-forge',
        path: '/why-use-forge',
        title: 'Why use Forge',
        onAccess: [loadContent('why-use-forge')],
        blocks: [contentBlock],
      }),
      step({
        code: 'installing-forge',
        path: '/installing-forge',
        title: 'Installing Forge',
        onAccess: [loadContent('installing-forge')],
        blocks: [contentBlock],
      }),
    ],
  })
}

// ---------------------------------------------------------------------------
// Forge package — wires the journey with its components and effects
// ---------------------------------------------------------------------------

function createGuidePackage() {
  return createForgePackage<GuideDeps>({
    journey: createGuideJourney(),
    components: [govukMarkdown, tableOfContentsComponent],
    functions: { ...GuideEffectsImplementations },
  })
}

// ---------------------------------------------------------------------------
// Page function — produces a full HTML page from Forge's rendered blocks
// ---------------------------------------------------------------------------

function renderPage({ context, blocks, basePath }: StaticPageRenderContext): string {
  const title = context.step.title ?? 'Untitled'

  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="UTF-8">',
    `  <title>${title} — Forge Guide</title>`,
    `  <link rel="stylesheet" href="${basePath}/assets/css/index.css">`,
    '</head>',
    '<body>',
    `  <main id="main" class="govuk-width-container">${blocks.join('\n')}</main>`,
    `  <script src="${basePath}/assets/js/index.js"></script>`,
    '</body>',
    '</html>',
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Test — builds a full static site from the developer guide
// ---------------------------------------------------------------------------

describe('StaticSiteGenerator (integration)', () => {
  let outputDir: string

  beforeEach(() => {
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-static-integration-'))
  })

  it('should bundle assets, generate pages, and produce a browsable static site', async () => {
    // 1. Bundle CSS/JS from the examples-app source assets
    const assetsOutputDir = path.join(outputDir, 'assets')

    await bundleAssets({
      jsEntry: path.join(examplesRoot, 'assets/js/index.js'),
      outputDir: assetsOutputDir,
      sassLoadPaths: [examplesRoot, path.join(examplesRoot, 'node_modules')],
      minify: true,
    })

    // 2. Load content from the developer guide markdown files
    const guideContentStore = new GuideContentStore(guideRoot)
    await guideContentStore.load()

    // 3. Create a Forge instance with the guide package
    const forge = new Forge({ logger: silentLogger }).registerPackage(createGuidePackage(), {
      guideContentStore,
      guideSearch: { search: async () => [], load: async () => {} } as never,
      formDataStore: {} as never,
      mocksApi: {} as never,
    })

    // 4. Generate static HTML pages from the journey topology
    const generator = new StaticSiteGenerator({
      forge,
      outputDir,
      renderer: new StaticHtmlRenderer({ page: renderPage }),
      logger: silentLogger,
    })

    const result = await generator.build()

    // 5. Verify the output
    expect(result.pages).toHaveLength(3)

    result.pages.forEach(page => {
      const html = fs.readFileSync(page.outputPath, 'utf-8')

      expect(html).toContain('<!DOCTYPE html>')
      expect(html).toContain('assets/css/index.css')
      expect(html).toContain('assets/js/index.js')
    })

    expect(fs.existsSync(path.join(assetsOutputDir, 'css/index.css'))).toBe(true)
    expect(fs.existsSync(path.join(assetsOutputDir, 'js/index.js'))).toBe(true)

    const getStartedHtml = fs.readFileSync(path.join(outputDir, 'guide/get-started/index.html'), 'utf-8')

    expect(getStartedHtml).toContain('Forge is a stateless framework')
    expect(getStartedHtml).toContain('govuk-heading')
  })
}, 30_000)
