import type { ContentEntry } from './guideContentStore'
import type PatternSourceStore from './patternSourceStore'

const GUIDE_PATH = 'forge-developer-guide'

const INDEX_PREAMBLE = [
  '# Forge Developer Guide',
  'Forge is a stateless, declarative framework for building multi-page journeys in GOV.UK services. You define journeys, steps, blocks, and fields as data structures and Forge handles routing, rendering, validation, and navigation.',
  'Documentation is organised into sections following a learning progression. Each page is self-contained but later sections build on earlier ones. Fetch individual pages at `/llms/content/forge-developer-guide/{path}` for full markdown, or `/llms-full.txt` for everything.',
  'Pattern pages include complete working demo source code showing the pattern implemented as a real Forge journey.',
]

const FULL_PREAMBLE = [
  '# Forge Developer Guide — Full Documentation',
  'Complete reference for the Forge framework. Generated from source documentation.',
]

const SECTIONS = [
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
    path: 'packages',
    title: 'Packages',
    description:
      'Package entry points, built-in components, conditions, generators, and transformers.',
  },
  {
    path: 'patterns',
    title: 'Patterns',
    description:
      'Common journey patterns with runnable demos: single question per page, branching, task lists, and more.',
  },
]

function extractLead(markdown: string): string {
  const lead: string[] = []
  let started = false

  for (const line of markdown.split('\n')) {
    const trimmed = line.trim()

    if (!started) {
      if (
        trimmed &&
        !trimmed.startsWith('#') &&
        !trimmed.startsWith('<') &&
        !trimmed.startsWith('{{') &&
        trimmed !== '---'
      ) {
        started = true
      }
    }

    if (started) {
      if (!trimmed || trimmed === '---' || trimmed.startsWith('{{') || trimmed.startsWith('#')) {
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

function strip(path: string): string {
  return path.replace(/^\/+|\/+$/g, '')
}

function sectionKey(entry: ContentEntry): string {
  return entry.section ?? entry.path.split('/')[0]
}

function contentLink(entry: ContentEntry): string {
  return `/llms/${GUIDE_PATH}/${strip(entry.path)}`
}

function resolvePath(basePath: string, relativePath: string): string {
  const segments = [...basePath.split('/').slice(0, -1), ...relativePath.split('/')]
  const resolved: string[] = []

  segments.forEach(seg => {
    if (seg === '..') {
      resolved.pop()
    } else if (seg && seg !== '.') {
      resolved.push(seg)
    }
  })

  return resolved.join('/')
}

function relativeSegments(sectionPath: string, entryPath: string): string[] {
  const rel = entryPath.startsWith(`${sectionPath}/`)
    ? entryPath.slice(sectionPath.length + 1)
    : entryPath

  return rel.split('/').filter(Boolean)
}

function groupBySection(entries: ContentEntry[]): Map<string, ContentEntry[]> {
  const groups = new Map<string, ContentEntry[]>()

  entries.forEach(entry => {
    const key = sectionKey(entry)
    const group = groups.get(key) ?? []
    group.push(entry)
    groups.set(key, group)
  })

  groups.forEach(group => {
    group.sort((a, b) => {
      const aKey = a.path.replace(/\/overview$/, '/!')
      const bKey = b.path.replace(/\/overview$/, '/!')

      return aKey.localeCompare(bKey)
    })
  })

  return groups
}

interface Group {
  overview?: ContentEntry
  entries: ContentEntry[]
  children: Map<string, Group>
}

function navigateGroup(root: Group, segments: string[]): Group {
  return segments.reduce((group, key) => {
    let child = group.children.get(key)

    if (!child) {
      child = { entries: [], children: new Map() }
      group.children.set(key, child)
    }

    return child
  }, root)
}

function buildGroupTree(sectionPath: string, entries: ContentEntry[]): Group {
  const root: Group = { entries: [], children: new Map() }

  entries.forEach(entry => {
    const segments = relativeSegments(sectionPath, entry.path)
    const isOverview = segments.at(-1) === 'overview' || segments.length === 0

    if (isOverview) {
      navigateGroup(root, segments.slice(0, -1)).overview = entry
    } else if (segments.length === 1) {
      root.entries.push(entry)
    } else {
      navigateGroup(root, segments.slice(0, -1)).entries.push(entry)
    }
  })

  return root
}

function forEachSection(
  entries: ContentEntry[],
  fn: (
    section: { title: string; description: string; path: string },
    group: ContentEntry[],
  ) => void,
): void {
  const groups = groupBySection(entries)
  const knownPaths = new Set(SECTIONS.map(s => s.path))

  SECTIONS.forEach(section => {
    const group = groups.get(section.path)

    if (group?.length) {
      fn(section, group)
    }
  })

  groups.forEach((group, key) => {
    if (!knownPaths.has(key)) {
      fn({ path: key, title: key, description: '' }, group)
    }
  })
}

export default class LlmsTextGenerator {
  constructor(private readonly patternSources: PatternSourceStore) {}

  buildIndex(entries: ContentEntry[]): string {
    const lines: string[] = [...INDEX_PREAMBLE, '']

    forEachSection(entries, (section, group) => {
      lines.push(`## ${section.title}`, '')

      if (section.description) {
        lines.push(section.description, '')
      }

      this.renderGroupIndex(lines, buildGroupTree(section.path, group), 2, entries)
      lines.push('')
    })

    return lines.join('\n')
  }

  buildFull(entries: ContentEntry[]): string {
    const parts: string[] = [...FULL_PREAMBLE]

    forEachSection(entries, (section, group) => {
      parts.push('---', '', `# Section: ${section.title}`, '')

      if (section.description) {
        parts.push(section.description, '')
      }

      group.forEach(entry => {
        parts.push('---', '', cleanMarkdown(this.resolveLinks(entry.markdown, entry.path, entries)))

        const demo = this.demoSourceBlock(entry.slug)

        if (demo) {
          parts.push(demo)
        }

        parts.push('')
      })
    })

    return parts.join('\n')
  }

  buildContentPage(entry: ContentEntry, entries: ContentEntry[]): string {
    return (
      cleanMarkdown(this.resolveLinks(entry.markdown, entry.path, entries)) +
      this.demoSourceBlock(entry.slug)
    )
  }

  findEntry(entries: ContentEntry[], rawPath: string | undefined): ContentEntry | undefined {
    if (!rawPath) {
      return undefined
    }

    const path = strip(rawPath)
    const guidePath = path.startsWith(`${GUIDE_PATH}/`) ? path.slice(GUIDE_PATH.length + 1) : path

    return entries.find(e => e.slug === guidePath || strip(e.path) === guidePath)
  }

  private resolveLinks(markdown: string, entryPath: string, entries: ContentEntry[]): string {
    return markdown.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text: string, href: string) => {
      if (/^(https?:|mailto:|\/|#)/.test(href)) {
        return match
      }

      const [linkPath, fragment] = href.split('#')
      const resolved = resolvePath(entryPath, linkPath)
      const target = entries.find(e => strip(e.path) === resolved || e.slug === resolved)

      if (!target) {
        return match
      }

      const anchor = fragment ? `#${fragment}` : ''

      return `[${text}](${contentLink(target)}${anchor})`
    })
  }

  private renderGroupIndex(
    lines: string[],
    group: Group,
    level: number,
    entries: ContentEntry[],
    key?: string,
  ): void {
    if (key) {
      const title =
        group.overview?.title ??
        key
          .split('-')
          .filter(Boolean)
          .map(w => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ')
      const lead = group.overview
        ? extractLead(this.resolveLinks(group.overview.markdown, group.overview.path, entries))
        : ''

      lines.push(`${'#'.repeat(level)} ${title}`, '')

      if (lead) {
        lines.push(lead, '')
      }
    }

    group.entries.forEach(entry => {
      const lead = extractLead(this.resolveLinks(entry.markdown, entry.path, entries))
      const description = lead ? `: ${lead}` : ''
      const patternName = entry.slug.startsWith('patterns-')
        ? entry.slug.slice('patterns-'.length)
        : undefined
      const demoCount = patternName ? this.patternSources.getDemo(patternName).length : 0
      const demoNote = demoCount > 0 ? ` (includes ${demoCount} demo source files)` : ''

      lines.push(`- [${entry.title}](${contentLink(entry)})${description}${demoNote}`)
    })

    if (group.entries.length > 0 && group.children.size > 0) {
      lines.push('')
    }

    let first = true

    group.children.forEach((child, childKey) => {
      if (!first) {
        lines.push('')
      }

      first = false
      this.renderGroupIndex(lines, child, level + 1, entries, childKey)
    })
  }

  private demoSourceBlock(slug: string): string {
    if (!slug.startsWith('patterns-')) {
      return ''
    }

    const files = this.patternSources.getDemo(slug.slice('patterns-'.length))

    if (files.length === 0) {
      return ''
    }

    const parts = ['', '---', '', '## Demo source code', '']

    files.forEach(file => {
      parts.push(`### ${file.path}`, '', '```typescript', file.source, '```', '')
    })

    return parts.join('\n')
  }
}
