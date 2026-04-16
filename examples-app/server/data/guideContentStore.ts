import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import logger from '../logger'

export interface ContentEntry {
  slug: string
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

function parseFrontmatter(raw: string): { frontmatter: Record<string, unknown>; markdown: string } {
  if (!raw.startsWith('---')) {
    return { frontmatter: {}, markdown: raw }
  }

  const endIndex = raw.indexOf('---', 3)

  if (endIndex === -1) {
    return { frontmatter: {}, markdown: raw }
  }

  const frontmatterBlock = raw.slice(3, endIndex).trim()
  const markdown = raw.slice(endIndex + 3).trim()

  const frontmatter: Record<string, unknown> = {}

  frontmatterBlock.split('\n').forEach(line => {
    const colonIndex = line.indexOf(':')

    if (colonIndex === -1) {
      return
    }

    const key = line.slice(0, colonIndex).trim()
    let value: unknown = line.slice(colonIndex + 1).trim()

    if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
      value = value
        .slice(1, -1)
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
    }

    frontmatter[key] = value
  })

  return { frontmatter, markdown }
}

export default class GuideContentStore {
  private entries = new Map<string, ContentEntry>()

  private loaded = false

  private loadPromise?: Promise<void>

  constructor(private contentDir: string) {}

  async load(): Promise<void> {
    if (this.loaded) {
      return
    }

    if (!this.loadPromise) {
      this.loadPromise = this.performLoad()
    }

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

    const headings: HeadingEntry[] = []
    const regex = /^## (.+)$/gm
    let match = regex.exec(markdown)

    while (match) {
      headings.push({ text: match[1], slug: slugifyHeading(match[1]) })
      match = regex.exec(markdown)
    }

    return headings
  }

  allEntries(): ContentEntry[] {
    return [...this.entries.values()]
  }

  private async performLoad(): Promise<void> {
    const files = await readdir(this.contentDir)
    const mdFiles = files.filter(f => f.endsWith('.md') && !f.startsWith('_'))

    const results = await Promise.all(
      mdFiles.map(async filename => {
        const slug = filename.replace(/\.md$/, '')
        const raw = await readFile(join(this.contentDir, filename), 'utf-8')
        const { frontmatter, markdown } = parseFrontmatter(raw)

        const entry: ContentEntry = {
          slug,
          path: (frontmatter.path as string) ?? slug,
          title: (frontmatter.title as string) ?? slug,
          tags: Array.isArray(frontmatter.teaches) ? (frontmatter.teaches as string[]) : [],
          markdown,
        }

        return entry
      }),
    )

    for (const entry of results) {
      this.entries.set(entry.slug, entry)
    }

    this.loaded = true
    logger.info({ count: this.entries.size }, 'Guide content loaded')
  }
}
