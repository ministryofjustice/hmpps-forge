import { readFile, readdir } from 'node:fs/promises'
import { basename, join } from 'node:path'
import logger from '../logger'

export interface ContentEntry {
  slug: string
  section?: string
  path: string
  title: string
  tags: string[]
  markdown: string
}

export interface HeadingEntry {
  text: string
  slug: string
}

export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function parseFrontmatter(
  raw: string,
): { attrs: Record<string, unknown>; body: string } | undefined {
  if (!raw.startsWith('---')) {
    return undefined
  }

  const endIndex = raw.indexOf('---', 3)

  if (endIndex === -1) {
    return undefined
  }

  const attrs: Record<string, unknown> = {}

  raw
    .slice(3, endIndex)
    .trim()
    .split('\n')
    .forEach(line => {
      const colon = line.indexOf(':')

      if (colon === -1) {
        return
      }

      const key = line.slice(0, colon).trim()
      const value = line.slice(colon + 1).trim()

      if (value.startsWith('[') && value.endsWith(']')) {
        attrs[key] = value
          .slice(1, -1)
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
      } else {
        attrs[key] = value
      }
    })

  return { attrs, body: raw.slice(endIndex + 3).trim() }
}

export default class GuideContentStore {
  private entries = new Map<string, ContentEntry>()

  private loadPromise?: Promise<void>

  constructor(private readonly contentDir: string) {}

  async load(): Promise<void> {
    this.loadPromise ??= this.performLoad()
    await this.loadPromise
  }

  get(slug: string): ContentEntry | undefined {
    return this.entries.get(slug)
  }

  getMarkdown(slug: string): string | undefined {
    return this.entries.get(slug)?.markdown
  }

  getHeadings(slug: string): HeadingEntry[] {
    const markdown = this.getMarkdown(slug)

    if (!markdown) {
      return []
    }

    return [...markdown.matchAll(/^## (.+)$/gm)].map(m => ({
      text: m[1],
      slug: slugifyHeading(m[1]),
    }))
  }

  allEntries(): ContentEntry[] {
    return [...this.entries.values()]
  }

  private async performLoad(): Promise<void> {
    const files = await readdir(this.contentDir, { recursive: true })

    const mdFiles = files
      .filter(f => f.endsWith('.md') && !basename(f).startsWith('_'))
      .map(f => join(this.contentDir, f))

    await Promise.all(
      mdFiles.map(async filePath => {
        const slug = basename(filePath, '.md')
        const parsed = parseFrontmatter(await readFile(filePath, 'utf-8'))

        if (!parsed) {
          return
        }

        const title = typeof parsed.attrs.title === 'string' ? parsed.attrs.title : undefined
        const path = typeof parsed.attrs.path === 'string' ? parsed.attrs.path : undefined

        if (!title || !path) {
          return
        }

        if (this.entries.has(slug)) {
          throw new Error(`Duplicate guide content slug "${slug}"`)
        }

        this.entries.set(slug, {
          slug,
          section: typeof parsed.attrs.section === 'string' ? parsed.attrs.section : undefined,
          path,
          title,
          tags: Array.isArray(parsed.attrs.teaches) ? parsed.attrs.teaches : [],
          markdown: parsed.body,
        })
      }),
    )

    logger.info({ count: this.entries.size }, 'Guide content loaded')
  }
}
