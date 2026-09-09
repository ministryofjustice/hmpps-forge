import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  journey,
  step,
  type JourneyDefinition,
  type StepDefinition,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContentV2 } from './effects'
import { contentBlock } from './contentBlock'

export interface SectionConfig {
  code: string
  title: string
  path: string
}

interface PageFrontmatter {
  title: string
  slug: string
  order: number
  nav?: string
  related?: Record<string, string>
  next?: Record<string, string>
}

/**
 * Builds a section journey whose steps are generated from the markdown files in
 * a content folder. This runs once at startup, before `registerPackage()`, so
 * the generated `step()` definitions are real steps by the time Forge compiles -
 * route tree, navigation, and titles all work as if the steps had been hand-authored.
 *
 * The directory is read synchronously because this only ever runs at boot; the
 * markdown bodies themselves stay lazily loaded per request via GuideContentStore.
 */
export class MarkdownSectionFactory {
  constructor(
    private readonly sectionDir: string,
    private readonly section: SectionConfig,
  ) {}

  build(): JourneyDefinition {
    const pages = this.readPages().sort((a, b) => a.order - b.order)

    return journey({
      code: this.section.code,
      title: this.section.title,
      path: this.section.path,
      view: { locals: { showBackToTop: true } },
      steps: pages.map(page => this.toStep(page)),
    })
  }

  private readPages(): PageFrontmatter[] {
    const files = readdirSync(this.sectionDir, { encoding: 'utf8', recursive: true }).filter(file =>
      file.endsWith('.md'),
    )

    return files.map(file => this.parsePage(join(this.sectionDir, file), file))
  }

  private parsePage(filePath: string, fileName: string): PageFrontmatter {
    const attrs = this.parseFrontmatter(readFileSync(filePath, 'utf-8'), fileName)

    const { title } = attrs
    const { slug } = attrs

    if (typeof title !== 'string' || !title) {
      throw new Error(`Guide v2 content "${fileName}" is missing a "title" in its frontmatter`)
    }

    if (typeof slug !== 'string' || !slug) {
      throw new Error(`Guide v2 content "${fileName}" is missing a "slug" in its frontmatter`)
    }

    const order = Number(attrs.order)
    const related =
      attrs.related && typeof attrs.related === 'object'
        ? (attrs.related as Record<string, string>)
        : undefined
    const next =
      attrs.next && typeof attrs.next === 'object'
        ? (attrs.next as Record<string, string>)
        : undefined

    return {
      title,
      slug,
      order: Number.isFinite(order) ? order : Number.MAX_SAFE_INTEGER,
      nav: typeof attrs.nav === 'string' ? attrs.nav : undefined,
      related: related && Object.keys(related).length > 0 ? related : undefined,
      next: next && Object.keys(next).length > 0 ? next : undefined,
    }
  }

  private toStep(page: PageFrontmatter): StepDefinition {
    return step({
      path: `/${page.slug}`,
      title: page.title,
      reachability: { entryWhen: true },
      metadata: {
        ...(page.nav ? { nav: page.nav } : {}),
        quadrant: this.section.code,
        ...(page.related ? { related: page.related } : {}),
        ...(page.next ? { next: page.next } : {}),
      },
      onAccess: [loadContentV2(page.slug, page.related, page.next)],
      blocks: [contentBlock],
    })
  }

  /**
   * Minimal frontmatter parser. Handles `key: value`, inline arrays
   * (`[a, b]`), and a single level of nested map (an empty-valued key followed
   * by indented `subkey: value` lines, used by `related` and `next`). Unknown keys pass
   * through untouched so authors can grow the frontmatter scheme freely.
   */
  private parseFrontmatter(raw: string, fileName: string): Record<string, unknown> {
    if (!raw.startsWith('---')) {
      throw new Error(`Guide v2 content "${fileName}" is missing frontmatter`)
    }

    const end = raw.indexOf('---', 3)

    if (end === -1) {
      throw new Error(`Guide v2 content "${fileName}" has an unterminated frontmatter block`)
    }

    const attrs: Record<string, unknown> = {}
    let currentMap: Record<string, string> | undefined

    this.toLogicalLines(raw.slice(3, end)).forEach(line => {
      if (!line.trim()) {
        return
      }

      const colon = line.indexOf(':')

      if (colon === -1) {
        return
      }

      if (/^\s/.test(line) && currentMap) {
        currentMap[line.slice(0, colon).trim()] = this.parseMapValue(line.slice(colon + 1).trim())

        return
      }

      currentMap = undefined

      const key = line.slice(0, colon).trim()
      const value = line.slice(colon + 1).trim()

      if (value === '') {
        const map: Record<string, string> = {}
        attrs[key] = map
        currentMap = map
      } else if (value.startsWith('[') && value.endsWith(']')) {
        attrs[key] = value
          .slice(1, -1)
          .split(',')
          .map(item => item.trim())
          .filter(Boolean)
      } else {
        attrs[key] = value
      }
    })

    return attrs
  }

  /**
   * Folds a frontmatter block into logical lines so the line parser sees each
   * key with its complete value. Arrays are written across several lines - either
   * inline (`teaches: [` then items then `]`) or with the opening bracket under
   * an empty-valued key (`concept:` then `[` then items) - so any line opening a
   * bracket that stays unclosed absorbs following lines until it closes, and a
   * bracket that opens directly under a bare `key:` is reattached to that key.
   */
  private toLogicalLines(block: string): string[] {
    const logicalLines: string[] = []
    let buffer = ''
    let depth = 0

    block.split('\n').forEach(line => {
      if (depth > 0) {
        buffer += ` ${line.trim()}`
      } else if (buffer !== '' && /:\s*$/.test(buffer) && line.trim().startsWith('[')) {
        buffer += ` ${line.trim()}`
      } else {
        if (buffer !== '') {
          logicalLines.push(buffer)
        }

        buffer = line
      }

      depth += this.countBracketDepth(line)
    })

    if (buffer !== '') {
      logicalLines.push(buffer)
    }

    return logicalLines
  }

  private countBracketDepth(line: string): number {
    const opened = (line.match(/\[/g) ?? []).length
    const closed = (line.match(/\]/g) ?? []).length

    return opened - closed
  }

  private parseMapValue(value: string): string {
    if (value.startsWith('[') && value.endsWith(']')) {
      return value
        .slice(1, -1)
        .split(',')
        .map(item => item.trim())
        .filter(Boolean)
        .join(',')
    }

    return value
  }
}
