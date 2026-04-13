import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import logger from '../logger'
import type EmbeddingIndex from './embeddings/embeddingIndex'

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

export interface SearchResultSection {
  heading: string
  href: string
}

export interface SearchResult {
  slug: string
  title: string
  href: string
  excerpt: string
  sections: SearchResultSection[]
}

export interface GuideChunk {
  slug: string
  path: string
  title: string
  tags: string[]
  heading: string
  text: string
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

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\{\{slot:[^}]*\}\}/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\|.*\|$/gm, '')
    .replace(/^[-|: ]+$/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/[*_~#]/g, '')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

function extractExcerpt(text: string, maxLength = 300): string {
  const cleaned = text
    .replace(/^#+\s+.*/gm, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\{\{slot:[^}]*\}\}/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_~|>#-]/g, '')
    .replace(/\n{2,}/g, '\n')
    .trim()

  const lines = cleaned.split('\n').filter(line => line.trim().length > 0)
  let result = ''

  for (const line of lines) {
    const candidate = result ? `${result} ${line}` : line

    if (candidate.length > maxLength) {
      break
    }

    result = candidate
  }

  return result ? `${result}...` : ''
}

export function chunkEntries(entries: ContentEntry[]): GuideChunk[] {
  return entries.flatMap(entry => {
    const sections = entry.markdown.split(/^(?=## )/m)

    return sections
      .map(section => {
        const headingMatch = section.match(/^## (.+)$/m)
        const heading = headingMatch?.[1] ?? 'Introduction'
        const text = section.replace(/^## .+$/m, '').trim()

        return {
          slug: entry.slug,
          path: entry.path,
          title: entry.title,
          tags: entry.tags,
          heading,
          text,
        }
      })
      .filter(chunk => chunk.text.length >= 50)
  })
}

function chunkToEmbeddingText(chunk: GuideChunk): string {
  const tagStr = chunk.tags.length > 0 ? ` [${chunk.tags.join(', ')}]` : ''

  return `${chunk.title}${tagStr} - ${chunk.heading}: ${stripMarkdown(chunk.text)}`
}

interface ScoredChunk {
  index: number
  score: number
}

export default class GuideContentStore {
  private entries = new Map<string, ContentEntry>()

  private chunks: GuideChunk[] = []

  private loaded = false

  constructor(
    private contentDir: string,
    private embeddingIndex?: EmbeddingIndex,
  ) {}

  async load(): Promise<void> {
    if (this.loaded) {
      return
    }

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

    this.chunks = chunkEntries([...this.entries.values()])
    this.loaded = true
    logger.info({ count: this.entries.size }, 'Guide content loaded')

    if (this.embeddingIndex && this.chunks.length > 0) {
      const texts = this.chunks.map(chunkToEmbeddingText)
      this.embeddingIndex.buildIndex(texts)
    }
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

  async search(query: string): Promise<SearchResult[]> {
    let scored: ScoredChunk[]

    if (this.embeddingIndex?.isReady) {
      try {
        scored = await this.hybridScore(query)
      } catch (err) {
        logger.warn({ err }, 'Semantic search failed, falling back to keyword search')
        scored = this.keywordScore(query)
      }
    } else {
      scored = this.keywordScore(query)
    }

    return this.groupByPage(scored)
  }

  listAll(): { slug: string; title: string }[] {
    return [...this.entries.values()].map(e => ({ slug: e.slug, title: e.title }))
  }

  private async hybridScore(query: string): Promise<ScoredChunk[]> {
    const semanticMatches = await this.embeddingIndex!.search(query, 20, 0.3)
    const keywordScores = this.scoreKeywords(query)

    const maxSemantic = semanticMatches[0]?.score ?? 1
    const maxKeyword = keywordScores.reduce((max, s) => Math.max(max, s), 0) || 1

    const combined = new Map<number, number>()

    semanticMatches.forEach(match => {
      const normalised = match.score / maxSemantic
      combined.set(match.index, normalised * 0.6)
    })

    keywordScores.forEach((score, index) => {
      if (score === 0) {
        return
      }

      const normalised = score / maxKeyword
      const existing = combined.get(index) ?? 0
      combined.set(index, existing + normalised * 0.4)
    })

    return [...combined.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 25)
      .map(([index, score]) => ({ index, score }))
  }

  private scoreKeywords(query: string): number[] {
    const terms = query
      .toLowerCase()
      .split(/\s+/)
      .filter(t => t.length > 1)

    if (terms.length === 0) {
      return this.chunks.map(() => 0)
    }

    return this.chunks.map(chunk => {
      const titleLower = chunk.title.toLowerCase()
      const tagsLower = chunk.tags.map(t => t.toLowerCase())
      const headingLower = chunk.heading.toLowerCase()
      const textLower = chunk.text.toLowerCase()

      let score = 0

      terms.forEach(term => {
        if (titleLower.includes(term)) {
          score += 10
        }

        if (tagsLower.some(tag => tag.includes(term))) {
          score += 5
        }

        if (headingLower.includes(term)) {
          score += 8
        }

        if (textLower.includes(term)) {
          score += 1
        }
      })

      return score
    })
  }

  private keywordScore(query: string): ScoredChunk[] {
    const scores = this.scoreKeywords(query)

    return scores
      .map((score, index) => ({ index, score }))
      .filter(match => match.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 25)
  }

  private groupByPage(scored: ScoredChunk[]): SearchResult[] {
    const pages = new Map<string, { chunk: GuideChunk; score: number }[]>()

    scored.forEach(({ index, score }) => {
      const chunk = this.chunks[index]
      const existing = pages.get(chunk.slug)

      if (existing) {
        existing.push({ chunk, score })
      } else {
        pages.set(chunk.slug, [{ chunk, score }])
      }
    })

    return [...pages.values()].slice(0, 8).map(sections => {
      const best = sections[0]

      return {
        slug: best.chunk.slug,
        title: best.chunk.title,
        href: best.chunk.path,
        excerpt: extractExcerpt(best.chunk.text),
        sections: sections
          .filter(s => s.chunk.heading !== 'Introduction')
          .slice(0, 4)
          .map(s => ({
            heading: s.chunk.heading,
            href: `${s.chunk.path}#${slugifyHeading(s.chunk.heading)}`,
          })),
      }
    })
  }
}
