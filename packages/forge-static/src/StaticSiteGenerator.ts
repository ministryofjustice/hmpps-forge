import * as fs from 'node:fs'
import * as path from 'node:path'
import { NO_OP_RESPONSE_BINDINGS } from '@ministryofjustice/hmpps-forge/core/framework'
import type { ForgeRoute, Logger, RequestSnapshot } from '@ministryofjustice/hmpps-forge/core/framework'
import type { AssetSource, GeneratedPage, StaticBuildResult, StaticRenderContext, StaticSiteOptions, SkippedRoute } from './types'

const PARAM_PATTERN = /:[^/]+/

export class StaticSiteGenerator {
  private readonly forge: StaticSiteOptions['forge']

  private readonly outputDir: string

  private readonly render: StaticSiteOptions['render']

  private readonly origin: string

  private readonly assets: AssetSource[]

  private readonly logger: Logger | Console

  constructor(options: StaticSiteOptions) {
    this.forge = options.forge
    this.outputDir = options.outputDir
    this.render = options.render
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

      const page = await this.buildPage(route)

      if (page) {
        pages.push(page)
      } else {
        skipped.push({ route, reason: 'evaluation did not produce a render outcome' })
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

  private async buildPage(route: ForgeRoute): Promise<GeneratedPage | undefined> {
    const snapshot = this.createSnapshot(route)
    const outcome = await this.forge.evaluate(snapshot, { response: NO_OP_RESPONSE_BINDINGS })

    if (outcome.kind !== 'render') {
      this.logger.warn(`Route ${route.templatePath} returned '${outcome.kind}', skipping`)

      return undefined
    }

    const relativePath = this.toFilePath(route.templatePath)
    const depth = path.dirname(relativePath).split(path.sep).length
    const basePath = depth > 0 ? Array(depth).fill('..').join('/') : '.'
    const staticContext: StaticRenderContext = { basePath }
    const html = await this.render(outcome.context, outcome.componentRegistry, staticContext)
    const outputPath = path.join(this.outputDir, relativePath)

    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    fs.writeFileSync(outputPath, html, 'utf-8')

    this.logger.info(`Generated: ${relativePath}`)

    return { route, relativePath, outputPath }
  }

  private createSnapshot(route: ForgeRoute): RequestSnapshot {
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
      state: {},
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
