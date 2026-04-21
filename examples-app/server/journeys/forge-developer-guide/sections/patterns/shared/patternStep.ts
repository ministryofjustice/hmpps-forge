import path from 'node:path'
import { step, StepDefinition } from '@ministryofjustice/hmpps-forge/core/authoring'
import { readPatternSource } from './sourceReader'
import { highlightCode } from './codeHighlight'
import { sanitiseForDisplay } from './sanitiseForDisplay'

export type LineRange = [start: number, end: number]

export type CodeFileSpec =
  | string
  | {
      label?: string
      path: string
      language?: string
      lines?: LineRange[]
    }

export interface CodePanel {
  label: string
  html: string
}

export interface PlainCodePanel {
  label: string
  source: string
}

const resolvedPanelsByPattern = new Map<string, PlainCodePanel[]>()

export function getResolvedCodePanels(): ReadonlyMap<string, readonly PlainCodePanel[]> {
  return resolvedPanelsByPattern
}

export type PatternStepProps = Omit<StepDefinition, 'type' | 'view'> & {
  sourceBase?: string
  codeFiles?: CodeFileSpec[]
  templateLocals?: Record<string, unknown>
}

export function patternStep(props: PatternStepProps): StepDefinition {
  const { sourceBase, codeFiles, templateLocals, ...rest } = props
  const panels = (codeFiles ?? []).map(spec => resolvePanel(spec, sourceBase))

  return step({
    ...rest,
    view: {
      template: 'partials/pattern-step',
      locals: {
        ...templateLocals,
        codePanels: panels,
      },
    },
  })
}

function resolvePanel(spec: CodeFileSpec, sourceBase: string | undefined): CodePanel {
  const parsed = typeof spec === 'string' ? { path: spec } : spec
  const {
    label,
    path: rawPath,
    language,
    lines,
  } = parsed as {
    label?: string
    path: string
    language?: string
    lines?: LineRange[]
  }

  const specPath = typeof spec === 'string' ? spec : rawPath
  const resolvedPath = resolveSourcePath(rawPath, sourceBase)
  const resolvedLanguage = language ?? inferLanguage(resolvedPath)
  const source = readPatternSource(resolvedPath)
  const sliced = lines ? extractLineRanges(source, lines) : source
  const displaySource = resolvedLanguage === 'typescript' ? sanitiseForDisplay(sliced) : sliced
  const resolvedLabel = label ?? path.posix.basename(resolvedPath)

  if (sourceBase) {
    const patternName = sourceBase.split('/')[0]
    const displayPath = specPath.startsWith('/') ? specPath.slice(1) : specPath
    registerPanel(patternName, displayPath, displaySource)
  }

  return {
    label: resolvedLabel,
    html: highlightCode(displaySource, resolvedLanguage),
  }
}

function registerPanel(patternName: string, displayPath: string, source: string): void {
  const existing = resolvedPanelsByPattern.get(patternName) ?? []

  if (existing.some(p => p.label === displayPath)) {
    return
  }

  existing.push({ label: displayPath, source })
  resolvedPanelsByPattern.set(patternName, existing)
}

function extractLineRanges(source: string, ranges: LineRange[]): string {
  const sourceLines = source.split('\n')

  return ranges
    .map(([start, end]) => {
      const startIndex = Math.max(0, start - 1)
      const endIndex = Math.min(sourceLines.length, end)

      return sourceLines.slice(startIndex, endIndex).join('\n')
    })
    .join('\n\n// ...\n\n')
}

function resolveSourcePath(specPath: string, sourceBase: string | undefined): string {
  if (specPath.startsWith('/')) {
    return specPath.slice(1)
  }

  if (sourceBase) {
    return path.posix.join(sourceBase, specPath)
  }

  return specPath
}

function inferLanguage(filePath: string): string {
  const ext = path.posix.extname(filePath).toLowerCase()

  switch (ext) {
    case '.ts':
    case '.mts':
    case '.cts':
      return 'typescript'
    case '.js':
    case '.mjs':
    case '.cjs':
      return 'javascript'
    case '.njk':
      return 'nunjucks'
    case '.html':
    case '.xml':
      return 'html'
    case '.json':
      return 'json'
    case '.sh':
    case '.bash':
      return 'bash'
    case '.yaml':
    case '.yml':
      return 'yaml'
    default:
      return 'plaintext'
  }
}
