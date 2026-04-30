import fs from 'node:fs'
import path from 'node:path'
import { HtmlBlock, type BlockDefinition } from '@ministryofjustice/hmpps-forge/core/components'
import { highlightCode } from '../../patterns/shared/codeHighlight'

const PACKAGE_SOURCES_SUBPATH = 'package-sources'

const packageSourceRoots = [
  path.join(process.cwd(), '..', 'packages'),
  path.join(process.cwd(), 'packages'),
  path.join(__dirname, PACKAGE_SOURCES_SUBPATH),
  path.join(process.cwd(), 'dist', PACKAGE_SOURCES_SUBPATH),
  path.join(process.cwd(), 'examples-app', 'dist', PACKAGE_SOURCES_SUBPATH),
]

export interface SourceInterfaceSnippetProps {
  sourcePath: string
  names: readonly string[]
}

interface DeclarationMatch {
  declarationStart: number
  keyword: 'interface' | 'type' | 'enum'
}

export function SourceInterfaceSnippet(props: SourceInterfaceSnippetProps): BlockDefinition {
  const source = readPackageSource(props.sourcePath)
  const snippet = extractNamedTypeDeclarations(source, props.names)

  return HtmlBlock({ content: highlightCode(snippet, 'typescript') })
}

export function extractNamedTypeDeclarations(source: string, names: readonly string[]): string {
  return names.map(name => extractNamedTypeDeclaration(source, name)).join('\n\n')
}

function readPackageSource(relativePath: string): string {
  const resolvedRoot = packageSourceRoots.find(root => fs.existsSync(path.join(root, relativePath)))

  if (!resolvedRoot) {
    throw new Error(
      `Could not locate package source ${relativePath}. Tried: ${packageSourceRoots.join(', ')}.`,
    )
  }

  return fs.readFileSync(path.join(resolvedRoot, relativePath), 'utf-8')
}

function extractNamedTypeDeclaration(source: string, name: string): string {
  const match = findDeclarationMatch(source, name)

  if (!match) {
    throw new Error(`Could not find interface or type declaration named ${name}.`)
  }

  const start = findLeadingDocCommentStart(source, match.declarationStart)
  const end =
    match.keyword === 'type'
      ? findTypeAliasEnd(source, match.declarationStart)
      : findBracedDeclarationEnd(source, match.declarationStart)

  return source.slice(start, end).trim()
}

function findDeclarationMatch(source: string, name: string): DeclarationMatch | undefined {
  const namePattern = escapeRegExp(name)
  const declarationPattern = new RegExp(
    `(^|\\n)(?:export\\s+)?(interface|type|enum)\\s+${namePattern}\\b`,
    'm',
  )
  const match = declarationPattern.exec(source)

  if (!match) {
    return undefined
  }

  const keyword = match[2]

  if (!isDeclarationKeyword(keyword)) {
    return undefined
  }

  return {
    declarationStart: match.index + match[1].length,
    keyword,
  }
}

function isDeclarationKeyword(value: string): value is DeclarationMatch['keyword'] {
  return value === 'interface' || value === 'type' || value === 'enum'
}

function findLeadingDocCommentStart(source: string, declarationStart: number): number {
  const beforeDeclaration = source.slice(0, declarationStart)
  const trimmedBeforeDeclaration = beforeDeclaration.trimEnd()

  if (!trimmedBeforeDeclaration.endsWith('*/')) {
    return declarationStart
  }

  const commentStart = trimmedBeforeDeclaration.lastIndexOf('/**')

  if (commentStart === -1) {
    return declarationStart
  }

  return commentStart
}

function findTypeAliasEnd(source: string, declarationStart: number): number {
  const nextDeclarationPattern = /\n(?:export\s+)?(?:interface|type|enum|function|const|class)\s+/g
  nextDeclarationPattern.lastIndex = declarationStart + 1
  const nextDeclaration = nextDeclarationPattern.exec(source)

  if (!nextDeclaration) {
    return source.length
  }

  return nextDeclaration.index
}

function findBracedDeclarationEnd(source: string, declarationStart: number): number {
  const openBraceIndex = source.indexOf('{', declarationStart)

  if (openBraceIndex === -1) {
    throw new Error(`Could not find opening brace for declaration at ${declarationStart}.`)
  }

  return findMatchingBraceEnd(source, openBraceIndex)
}

function findMatchingBraceEnd(source: string, openBraceIndex: number): number {
  let depth = 0
  let inLineComment = false
  let inBlockComment = false
  let quote: '"' | "'" | '`' | undefined
  let index = openBraceIndex

  while (index < source.length) {
    const current = source[index]
    const next = source[index + 1]
    const previous = source[index - 1]

    if (inLineComment) {
      if (current === '\n') {
        inLineComment = false
      }
    } else if (inBlockComment) {
      if (current === '*' && next === '/') {
        inBlockComment = false
        index += 1
      }
    } else if (quote) {
      if (current === quote && previous !== '\\') {
        quote = undefined
      }
    } else if (current === '/' && next === '/') {
      inLineComment = true
      index += 1
    } else if (current === '/' && next === '*') {
      inBlockComment = true
      index += 1
    } else if (current === '"' || current === "'" || current === '`') {
      quote = current
    } else if (current === '{') {
      depth += 1
    } else if (current === '}') {
      depth -= 1

      if (depth === 0) {
        return index + 1
      }
    }

    index += 1
  }

  throw new Error(`Could not find matching closing brace for declaration at ${openBraceIndex}.`)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
