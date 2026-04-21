import MiniSearch from 'minisearch'
import { stemmer } from 'stemmer'
import logger from '../logger'
import type EmbeddingIndex from './embeddings/embeddingIndex'
import type GuideContentStore from './guideContentStore'
import { slugifyHeading } from './guideContentStore'
import type { ContentEntry } from './guideContentStore'

export interface GuideChunk {
  slug: string
  path: string
  title: string
  tags: string[]
  heading: string
  headingPath: string
  text: string
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

const MAX_BODY_CHARS = 1000

const OVERLAP_CHARS = 200

const MIN_CHUNK_CHARS = 50

const RRF_K = 60

const TOP_PER_SIGNAL = 30

const MAX_RESULTS = 25

const MAX_PAGES = 8

const MAX_SECTIONS_PER_PAGE = 4

const EXCERPT_MAX_LENGTH = 300

const EXCERPT_CONTEXT_CHARS = 80

interface HeadingSection {
  heading: string
  headingPath: string
  body: string
}

function splitIntoSections(markdown: string): HeadingSection[] {
  const headingRegex = /^(#{2,3}) (.+)$/gm
  const matches = [...markdown.matchAll(headingRegex)]

  if (matches.length === 0) {
    const body = markdown.trim()

    return body.length > 0 ? [{ heading: 'Introduction', headingPath: 'Introduction', body }] : []
  }

  const sections: HeadingSection[] = []
  const preamble = markdown.slice(0, matches[0].index ?? 0).trim()

  if (preamble.length > 0) {
    sections.push({ heading: 'Introduction', headingPath: 'Introduction', body: preamble })
  }

  let currentH2: string | undefined

  matches.forEach((match, i) => {
    const level = match[1].length
    const heading = match[2].trim()
    const bodyStart = (match.index ?? 0) + match[0].length
    const bodyEnd = matches[i + 1]?.index ?? markdown.length
    const body = markdown.slice(bodyStart, bodyEnd).trim()

    if (level === 2) {
      currentH2 = heading
    }

    if (body.length === 0) {
      return
    }

    if (level === 2) {
      sections.push({ heading, headingPath: heading, body })

      return
    }

    const headingPath = currentH2 ? `${currentH2} > ${heading}` : heading

    sections.push({ heading, headingPath, body })
  })

  return sections
}

function splitBodyWithOverlap(body: string, maxChars: number, overlapChars: number): string[] {
  if (body.length <= maxChars) {
    return [body]
  }

  const paragraphs = body
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0)

  if (paragraphs.length === 0) {
    return [body]
  }

  const chunks: string[] = []
  let current: string[] = []
  let currentLen = 0

  paragraphs.forEach(paragraph => {
    if (paragraph.length > maxChars) {
      if (current.length > 0) {
        chunks.push(current.join('\n\n'))
        current = []
        currentLen = 0
      }

      for (let i = 0; i < paragraph.length; i += maxChars - overlapChars) {
        chunks.push(paragraph.slice(i, i + maxChars))
      }

      return
    }

    const separatorLen = current.length > 0 ? 2 : 0

    if (currentLen + separatorLen + paragraph.length > maxChars && current.length > 0) {
      chunks.push(current.join('\n\n'))
      const lastParagraph = current[current.length - 1]

      if (lastParagraph.length <= overlapChars) {
        current = [lastParagraph, paragraph]
        currentLen = lastParagraph.length + 2 + paragraph.length
      } else {
        current = [paragraph]
        currentLen = paragraph.length
      }

      return
    }

    current.push(paragraph)
    currentLen += separatorLen + paragraph.length
  })

  if (current.length > 0) {
    chunks.push(current.join('\n\n'))
  }

  return chunks
}

export function chunkEntries(entries: ContentEntry[]): GuideChunk[] {
  return entries.flatMap(entry => {
    const sections = splitIntoSections(entry.markdown)

    return sections
      .flatMap(section => {
        const bodies = splitBodyWithOverlap(section.body, MAX_BODY_CHARS, OVERLAP_CHARS)

        return bodies.map(text => ({
          slug: entry.slug,
          path: entry.path,
          title: entry.title,
          tags: entry.tags,
          heading: section.heading,
          headingPath: section.headingPath,
          text,
        }))
      })
      .filter(chunk => chunk.text.length >= MIN_CHUNK_CHARS)
  })
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

function cleanTextForExcerpt(text: string): string {
  return text
    .replace(/^#+\s+.*/gm, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\{\{slot:[^}]*\}\}/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_~|>#-]/g, '')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

function chunkToEmbeddingText(chunk: GuideChunk): string {
  const tagStr = chunk.tags.length > 0 ? ` [${chunk.tags.join(', ')}]` : ''

  return `${chunk.title}${tagStr} - ${chunk.headingPath}: ${stripMarkdown(chunk.text)}`
}

interface ScoredChunk {
  index: number
  score: number
  matchedTerms: string[]
}

interface KeywordDocument {
  id: number
  title: string
  heading: string
  tags: string
  text: string
}

function processSearchTerm(term: string): string | string[] | null {
  const lower = term.toLowerCase()

  if (lower.length < 2) {
    return null
  }

  const stem = stemmer(lower)

  if (stem === lower) {
    return lower
  }

  return [lower, stem]
}

function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map(token => token.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(token => token.length >= 2)
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function takeLines(text: string, maxLength: number): string {
  const lines = text.split('\n').filter(line => line.trim().length > 0)
  let result = ''

  for (const line of lines) {
    const candidate = result ? `${result} ${line}` : line

    if (candidate.length > maxLength) {
      break
    }

    result = candidate
  }

  return result
}

function findFirstMatchIndex(text: string, terms: string[]): number {
  const lowered = text.toLowerCase()
  let firstMatchIndex = -1

  terms.forEach(term => {
    const index = lowered.indexOf(term.toLowerCase())

    if (index !== -1 && (firstMatchIndex === -1 || index < firstMatchIndex)) {
      firstMatchIndex = index
    }
  })

  return firstMatchIndex
}

function pickSnippet(text: string, terms: string[], maxLength: number): string {
  if (terms.length === 0) {
    return takeLines(text, maxLength)
  }

  const firstMatchIndex = findFirstMatchIndex(text, terms)

  if (firstMatchIndex === -1 || firstMatchIndex < EXCERPT_CONTEXT_CHARS) {
    return takeLines(text, maxLength)
  }

  const windowStart = Math.max(0, firstMatchIndex - EXCERPT_CONTEXT_CHARS)
  const nextSpace = text.indexOf(' ', windowStart)
  const adjusted = nextSpace === -1 ? windowStart : nextSpace + 1

  return text.slice(adjusted, adjusted + maxLength).trim()
}

function highlightTerms(escapedHtml: string, terms: string[]): string {
  if (terms.length === 0) {
    return escapedHtml
  }

  const pattern = new RegExp(`\\b(${terms.map(escapeRegex).join('|')})\\b`, 'gi')

  return escapedHtml.replace(pattern, '<mark>$1</mark>')
}

export function buildExcerpt(text: string, terms: string[]): string {
  const cleaned = cleanTextForExcerpt(text)

  if (cleaned.length === 0) {
    return ''
  }

  const snippet = pickSnippet(cleaned, terms, EXCERPT_MAX_LENGTH)

  if (snippet.length === 0) {
    return ''
  }

  const escaped = escapeHtml(snippet)
  const highlighted = highlightTerms(escaped, terms)

  return `${highlighted}...`
}

export default class GuideSearch {
  private chunks: GuideChunk[] = []

  private miniSearch?: MiniSearch<KeywordDocument>

  private loaded = false

  private loadPromise?: Promise<void>

  constructor(
    private contentStore: GuideContentStore,
    private embeddingIndex?: EmbeddingIndex,
  ) {}

  async load(): Promise<void> {
    if (this.loaded) {
      return
    }

    if (!this.loadPromise) {
      this.loadPromise = this.performLoad()
    }

    await this.loadPromise
  }

  async search(query: string): Promise<SearchResult[]> {
    await this.load()

    const queryTerms = tokenizeQuery(query)
    let scored: ScoredChunk[]

    if (this.embeddingIndex?.isReady) {
      try {
        scored = await this.hybridScore(query, queryTerms)
      } catch (err) {
        logger.warn({ err }, 'Semantic search failed, falling back to keyword search')
        scored = this.keywordScore(query, queryTerms)
      }
    } else {
      scored = this.keywordScore(query, queryTerms)
    }

    return this.groupByPage(scored, queryTerms)
  }

  private async performLoad(): Promise<void> {
    await this.contentStore.load()
    this.chunks = chunkEntries(this.contentStore.allEntries())
    this.buildKeywordIndex()
    this.loaded = true
    logger.info({ count: this.chunks.length }, 'Guide search index built')

    if (this.embeddingIndex && this.chunks.length > 0) {
      const embeddingTexts = this.chunks.map(chunkToEmbeddingText)

      this.embeddingIndex.buildIndex(embeddingTexts, {
        enabled: process.env.EMBEDDING_DEBUG_EXPORT === 'true',
        chunks: this.chunks.map((chunk, index) => ({
          slug: chunk.slug,
          path: chunk.path,
          title: chunk.title,
          heading: chunk.heading,
          tags: chunk.tags,
          text: chunk.text,
          embeddingText: embeddingTexts[index],
        })),
        queries: [
          'how do I build a multi-page journey?',
          'how is validation configured?',
          'how do routes and navigation work?',
        ],
      })
    }
  }

  private async hybridScore(query: string, queryTerms: string[]): Promise<ScoredChunk[]> {
    const semanticMatches = await this.embeddingIndex!.search(query, TOP_PER_SIGNAL, 0.3)
    const keywordMatches = this.keywordScore(query, queryTerms).slice(0, TOP_PER_SIGNAL)

    const fused = new Map<number, { score: number; matchedTerms: Set<string> }>()

    const addToFusion = (index: number, rank: number, matchedTerms: string[]) => {
      const existing = fused.get(index)
      const rrf = 1 / (RRF_K + rank + 1)

      if (existing) {
        existing.score += rrf
        matchedTerms.forEach(term => existing.matchedTerms.add(term))

        return
      }

      fused.set(index, { score: rrf, matchedTerms: new Set(matchedTerms) })
    }

    semanticMatches.forEach((match, rank) => addToFusion(match.index, rank, queryTerms))
    keywordMatches.forEach((match, rank) => addToFusion(match.index, rank, match.matchedTerms))

    return [...fused.entries()]
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, MAX_RESULTS)
      .map(([index, { score, matchedTerms }]) => ({
        index,
        score,
        matchedTerms: [...matchedTerms],
      }))
  }

  private keywordScore(query: string, queryTerms: string[]): ScoredChunk[] {
    if (!this.miniSearch) {
      return []
    }

    return this.miniSearch
      .search(query)
      .slice(0, MAX_RESULTS)
      .map(result => ({
        index: result.id as number,
        score: result.score,
        matchedTerms: result.terms.length > 0 ? result.terms : queryTerms,
      }))
  }

  private buildKeywordIndex(): void {
    if (this.chunks.length === 0) {
      return
    }

    this.miniSearch = new MiniSearch<KeywordDocument>({
      fields: ['title', 'heading', 'tags', 'text'],
      storeFields: [],
      processTerm: term => processSearchTerm(term),
      searchOptions: {
        boost: { title: 3, heading: 2, tags: 2 },
        combineWith: 'OR',
      },
    })

    const documents = this.chunks.map<KeywordDocument>((chunk, id) => ({
      id,
      title: chunk.title,
      heading: chunk.headingPath,
      tags: chunk.tags.join(' '),
      text: stripMarkdown(chunk.text),
    }))

    this.miniSearch.addAll(documents)
  }

  private groupByPage(scored: ScoredChunk[], queryTerms: string[]): SearchResult[] {
    const pages = new Map<string, { chunk: GuideChunk; score: number; matchedTerms: string[] }[]>()

    scored.forEach(({ index, score, matchedTerms }) => {
      const chunk = this.chunks[index]
      const existing = pages.get(chunk.slug)

      if (existing) {
        existing.push({ chunk, score, matchedTerms })
      } else {
        pages.set(chunk.slug, [{ chunk, score, matchedTerms }])
      }
    })

    return [...pages.values()].slice(0, MAX_PAGES).map(sections => {
      const best = sections[0]
      const excerptTerms = best.matchedTerms.length > 0 ? best.matchedTerms : queryTerms
      const seenHrefs = new Set<string>()
      const uniqueSections = sections
        .filter(s => s.chunk.heading !== 'Introduction')
        .map(s => ({
          heading: s.chunk.heading,
          href: `${s.chunk.path}#${slugifyHeading(s.chunk.heading)}`,
        }))
        .filter(section => {
          if (seenHrefs.has(section.href)) {
            return false
          }

          seenHrefs.add(section.href)

          return true
        })
        .slice(0, MAX_SECTIONS_PER_PAGE)

      return {
        slug: best.chunk.slug,
        title: best.chunk.title,
        href: best.chunk.path,
        excerpt: buildExcerpt(best.chunk.text, excerptTerms),
        sections: uniqueSections,
      }
    })
  }
}
