import path from 'node:path'
import { step, StepDefinition } from '@ministryofjustice/hmpps-forge/core/authoring'
import { readPatternSource } from './sourceReader'
import { highlightCode } from './codeHighlight'
import { sanitiseForDisplay } from './sanitiseForDisplay'

export type CodeFileSpec =
  | string
  | {
      label?: string
      path: string
      language?: string
    }

export interface CodePanel {
  label: string
  html: string
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
  const { label, path: rawPath, language } = typeof spec === 'string' ? { path: spec } : spec
  const resolvedPath = resolveSourcePath(rawPath, sourceBase)
  const resolvedLanguage = language ?? inferLanguage(resolvedPath)
  const source = readPatternSource(resolvedPath)
  const displaySource = resolvedLanguage === 'typescript' ? sanitiseForDisplay(source) : source

  return {
    label: label ?? path.posix.basename(resolvedPath),
    html: highlightCode(displaySource, resolvedLanguage),
  }
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
