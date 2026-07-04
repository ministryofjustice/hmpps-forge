import * as fs from 'node:fs'
import * as path from 'node:path'
import { NO_OP_RESPONSE_BINDINGS } from '@ministryofjustice/hmpps-forge/core/framework'
import type { ForgeRenderer, ForgeRoute, Logger, RequestSnapshot } from '@ministryofjustice/hmpps-forge/core/framework'
import { FORGE_STATIC_BASE_PATH, StaticHtmlRenderer } from './StaticHtmlRenderer'
import type { AssetSource, GeneratedPage, StaticBuildResult, StaticSiteOptions, SkippedRoute } from './types'

const PARAM_PATTERN = /:[^/]+/

export class StaticSiteGenerator {
  private readonly forge: StaticSiteOptions['forge']

  private readonly outputDir: string

  private readonly renderer: ForgeRenderer<string>

  private readonly origin: string

  private readonly assets: AssetSource[]

  private readonly logger: Logger | Console

  constructor(options: StaticSiteOptions) {
    this.forge = options.forge
    this.outputDir = options.outputDir
    this.renderer = options.renderer ?? new StaticHtmlRenderer()
    this.assets = options.assets ?? []
    this.origin = options.origin ?? 'http://localhost'
    this.logger = options.logger ?? console
  }

  async build(): Promise<StaticBuildResult> {
    const topology = this.forge.getTopology()
    const pages: GeneratedPage[] = []
    const skipped: SkippedRoute[] = []

    fs.mkdirSync(this.outputDir, { recursive: true })

    for (const route of topology.routes) {
      const skipReason = this.getSkipReason(route)

      if (skipReason) {
        skipped.push({ route, reason: skipReason })
        continue
      }

      const result = await this.buildPage(route)

      if ('reason' in result) {
        skipped.push(result)
      } else {
        pages.push(result)
      }
    }

    this.copyAssets()

    this.logger.info(`Built ${pages.length} pages, skipped ${skipped.length} routes`)

    return { pages, skipped }
  }

  private getSkipReason(route: ForgeRoute): string | undefined {
    if (route.kind !== 'step') {
      return 'not a step route'
    }

    if (!route.methods.includes('GET')) {
      return 'no GET method'
    }

    if (PARAM_PATTERN.test(route.templatePath)) {
      this.logger.warn(`Skipping dynamic route: ${route.templatePath}`)

      return `dynamic route: ${route.templatePath}`
    }

    return undefined
  }

  private async buildPage(route: ForgeRoute): Promise<GeneratedPage | SkippedRoute> {
    const relativePath = this.toFilePath(route.templatePath)
    const dirname = path.dirname(relativePath)
    const basePath = dirname === '.' ? '.' : Array(dirname.split(path.sep).length).fill('..').join('/')

    const snapshot = this.createSnapshot(route, basePath)
    const outcome = await this.forge.execute({
      snapshot,
      responseBindings: NO_OP_RESPONSE_BINDINGS,
      renderer: this.renderer,
    })

    if (outcome.kind !== 'render') {
      this.logger.warn(`Route ${route.templatePath} returned '${outcome.kind}', skipping`)

      return { route, reason: 'evaluation did not produce a render outcome' }
    }

    if (typeof outcome.output !== 'string') {
      this.logger.warn(`Route ${route.templatePath} produced no output, skipping`)

      return { route, reason: 'renderer produced no output' }
    }

    const outputPath = path.join(this.outputDir, relativePath)

    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    fs.writeFileSync(outputPath, outcome.output, 'utf-8')

    this.logger.info(`Generated: ${relativePath}`)

    return { route, relativePath, outputPath }
  }

  private createSnapshot(route: ForgeRoute, basePath: string): RequestSnapshot {
    const pathname = route.templatePath
    const href = `${this.origin}${pathname}`

    return {
      nodeId: route.nodeId,
      method: 'GET',
      location: { origin: this.origin, href, pathname, basePath: route.basePath },
      params: {},
      query: {},
      post: {},
      headers: {},
      cookies: {},
      state: { [FORGE_STATIC_BASE_PATH]: basePath },
      session: null,
    }
  }

  private copyAssets(): void {
    this.assets.forEach(({ from, to }) => {
      if (!fs.existsSync(from)) {
        this.logger.warn(`Asset source not found: ${from}`)

        return
      }

      const dest = path.join(this.outputDir, to)

      fs.cpSync(from, dest, { recursive: true })
      this.logger.info(`Copied assets: ${from} → ${to}`)
    })
  }

  private toFilePath(templatePath: string): string {
    const normalized = templatePath.replace(/^\/+/, '')

    if (!normalized) {
      return 'index.html'
    }

    return path.join(normalized, 'index.html')
  }
}
