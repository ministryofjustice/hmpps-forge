import type { Request, Response, NextFunction } from 'express'
import type GuideContentStore from '../data/guideContentStore'
import type { ContentEntry } from '../data/guideContentStore'
import type PatternSourceStore from '../data/patternSourceStore'
import type { PatternSourceFile } from '../data/patternSourceStore'

interface Section {
  path: string
  title: string
  description: string
}

const SECTIONS: Section[] = [
  {
    path: 'get-started',
    title: 'Get Started',
    description: 'Installation, project setup, and your first working journey.',
  },
  {
    path: 'building-journeys',
    title: 'Building Journeys',
    description:
      'Core journey authoring: defining journeys, steps, blocks, routing, hooks, and validation.',
  },
  {
    path: 'authoring-language',
    title: 'Authoring Language',
    description:
      'Expressions, references, functions, and dynamic properties for making definitions reactive.',
  },
  {
    path: 'building-functions-and-components',
    title: 'Building Functions & Components',
    description:
      'Creating custom transformers, generators, conditions, effects, and UI components.',
  },
  {
    path: 'patterns',
    title: 'Patterns',
    description:
      'Common journey patterns with runnable demos: single question per page, branching, task lists, and more.',
  },
]

function sectionKey(entry: ContentEntry): string {
  const slash = entry.path.indexOf('/')
  return slash === -1 ? entry.path : entry.path.slice(0, slash)
}

function isLeadSkippable(line: string): boolean {
  return (
    line === '' ||
    line.startsWith('#') ||
    line.startsWith('<') ||
    line.startsWith('{{') ||
    line === '---'
  )
}

function isLeadTerminator(line: string): boolean {
  return line === '' || line === '---' || line.startsWith('{{') || line.startsWith('#')
}

function extractLead(markdown: string): string {
  const lines = markdown.split('\n')
  let started = false
  const lead: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()

    if (!started) {
      if (isLeadSkippable(trimmed)) {
        // eslint-disable-next-line no-continue
        continue
      }
      started = true
    }

    if (started) {
      if (isLeadTerminator(trimmed)) {
        break
      }
      lead.push(trimmed)
    }
  }

  return lead.join(' ')
}

function cleanMarkdown(markdown: string): string {
  return markdown
    .replace(/\{\{slot:[^}]+\}\}/g, '')
    .replace(/<p class="govuk-caption-xl">[^<]*<\/p>\n*/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function formatDemoSource(files: PatternSourceFile[]): string {
  const parts = ['', '---', '', '## Demo source code', '']

  files.forEach(file => {
    parts.push(`### ${file.path}`, '', '```typescript', file.source, '```', '')
  })

  return parts.join('\n')
}

function patternNameFromSlug(slug: string): string | undefined {
  if (!slug.startsWith('patterns-')) {
    return undefined
  }

  return slug.slice('patterns-'.length)
}

function groupBySection(entries: ContentEntry[]): Map<string, ContentEntry[]> {
  const groups = new Map<string, ContentEntry[]>()

  entries.forEach(entry => {
    const key = sectionKey(entry)
    const group = groups.get(key) ?? []
    group.push(entry)
    groups.set(key, group)
  })

  for (const group of groups.values()) {
    group.sort((a, b) => {
      const aIsOverview = !a.path.includes('/')
      const bIsOverview = !b.path.includes('/')

      if (aIsOverview && !bIsOverview) {
        return -1
      }

      if (!aIsOverview && bIsOverview) {
        return 1
      }

      return a.path.localeCompare(b.path)
    })
  }

  return groups
}

function appendEntries(lines: string[], group: ContentEntry[]): void {
  group
    .filter(entry => entry.path.includes('/'))
    .forEach(entry => {
      const lead = extractLead(entry.markdown)
      const description = lead ? `: ${lead}` : ''
      lines.push(`- [${entry.title}](/llms/content/${entry.slug})${description}`)
    })
}

function appendSection(
  parts: string[],
  title: string,
  description: string,
  group: ContentEntry[] | undefined,
  patternSources: PatternSourceStore,
): void {
  if (!group?.length) {
    return
  }

  parts.push('---', '')
  parts.push(`# Section: ${title}`, '')

  if (description) {
    parts.push(description, '')
  }

  group.forEach(entry => {
    parts.push('---', '', cleanMarkdown(entry.markdown))

    const patternName = patternNameFromSlug(entry.slug)

    if (patternName) {
      const demoFiles = patternSources.getDemo(patternName)

      if (demoFiles.length > 0) {
        parts.push(formatDemoSource(demoFiles))
      }
    }

    parts.push('')
  })
}

function buildIndex(entries: ContentEntry[], patternSources: PatternSourceStore): string {
  const groups = groupBySection(entries)
  const knownSections = new Set(SECTIONS.map(s => s.path))

  const lines: string[] = [
    '# Forge Developer Guide',
    '',
    '> Forge is a stateless, declarative framework for building multi-page journeys in GOV.UK services. You define journeys, steps, blocks, and fields as data structures and Forge handles routing, rendering, validation, and navigation.',
    '',
    'Documentation is organised into sections following a learning progression. Each page is self-contained but later sections build on earlier ones. Fetch individual pages at `/llms/content/{slug}` for full markdown, or `/llms-full.txt` for everything.',
    '',
    'Pattern pages include complete working demo source code showing the pattern implemented as a real Forge journey.',
    '',
  ]

  SECTIONS.forEach(section => {
    const group = groups.get(section.path)

    if (group?.length) {
      lines.push(`## ${section.title}`, '', section.description, '')

      if (section.path === 'patterns') {
        appendPatternEntries(lines, group, patternSources)
      } else {
        appendEntries(lines, group)
      }

      lines.push('')
    }
  })

  groups.forEach((group, key) => {
    if (!knownSections.has(key)) {
      lines.push(`## ${key}`, '')
      appendEntries(lines, group)
      lines.push('')
    }
  })

  return lines.join('\n')
}

function appendPatternEntries(
  lines: string[],
  group: ContentEntry[],
  patternSources: PatternSourceStore,
): void {
  group
    .filter(entry => entry.path.includes('/'))
    .forEach(entry => {
      const lead = extractLead(entry.markdown)
      const description = lead ? `: ${lead}` : ''
      const patternName = patternNameFromSlug(entry.slug)
      const demoCount = patternName ? patternSources.getDemo(patternName).length : 0
      const demoNote = demoCount > 0 ? ` (includes ${demoCount} demo source files)` : ''
      lines.push(`- [${entry.title}](/llms/content/${entry.slug})${description}${demoNote}`)
    })
}

function buildFull(entries: ContentEntry[], patternSources: PatternSourceStore): string {
  const groups = groupBySection(entries)
  const knownSections = new Set(SECTIONS.map(s => s.path))

  const parts: string[] = [
    '# Forge Developer Guide — Full Documentation',
    '',
    '> Complete reference for the Forge framework. Generated from source documentation.',
    '',
  ]

  SECTIONS.forEach(section => {
    appendSection(
      parts,
      section.title,
      section.description,
      groups.get(section.path),
      patternSources,
    )
  })

  groups.forEach((group, key) => {
    if (!knownSections.has(key)) {
      appendSection(parts, key, '', group, patternSources)
    }
  })

  return parts.join('\n')
}

interface LlmsStores {
  contentStore: GuideContentStore
  patternSources: PatternSourceStore
}

export default function llmsTxtRoutes({ contentStore, patternSources }: LlmsStores) {
  async function loadStores() {
    await contentStore.load()
  }

  return {
    async index(req: Request, res: Response, next: NextFunction) {
      try {
        await loadStores()
        res
          .type('text/plain; charset=utf-8')
          .send(buildIndex(contentStore.allEntries(), patternSources))
      } catch (error) {
        next(error)
      }
    },

    async full(req: Request, res: Response, next: NextFunction) {
      try {
        await loadStores()
        res
          .type('text/plain; charset=utf-8')
          .send(buildFull(contentStore.allEntries(), patternSources))
      } catch (error) {
        next(error)
      }
    },

    async content(req: Request, res: Response, next: NextFunction) {
      try {
        await loadStores()
        const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug
        const entry = slug ? contentStore.get(slug) : undefined

        if (!entry) {
          res.status(404).type('text/plain').send('Not found')
          return
        }

        let body = cleanMarkdown(entry.markdown)

        const patternName = patternNameFromSlug(entry.slug)

        if (patternName) {
          const demoFiles = patternSources.getDemo(patternName)

          if (demoFiles.length > 0) {
            body += formatDemoSource(demoFiles)
          }
        }

        res.type('text/markdown; charset=utf-8').send(body)
      } catch (error) {
        next(error)
      }
    },
  }
}
