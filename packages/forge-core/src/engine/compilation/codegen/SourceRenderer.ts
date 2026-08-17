import { BlockNode, CodeNode, CodeNodeKind, TryCatchNode } from './codeNode.type'

/**
 * Renders a generated-code node tree into JavaScript source while resolving
 * the position markers the emitters left inline. The renderer knows each
 * line's final index and indentation as it writes, so marker positions become
 * source-map segments here — no post-pass over assembled source.
 */

export interface MarkerPosition {
  readonly file: string
  readonly line: number
  readonly column: number
}

export interface MarkerSegment {
  readonly generatedColumn: number
  readonly position: MarkerPosition
}

export interface RenderedSource {
  readonly source: string
  readonly segmentsByLine: readonly (readonly MarkerSegment[])[]
}

export enum GeneratedCodeStyle {
  READABLE = 'readable',
  COMPACT = 'compact',
}

export interface SourceRendererOptions {
  readonly style?: GeneratedCodeStyle
  /**
   * Leave markers in the rendered text instead of resolving them to segments.
   * Sub-emitters render this way when their output embeds into a larger tree,
   * so positions survive until the final render resolves them.
   */
  readonly preserveMarkers?: boolean
}

const MARKER_PATTERN = /\/\*@forge-pos:(\{.*?\})\*\//g

/**
 * Emits the inline comment carrying a node's defined-at position through
 * source assembly. JSON inside the comment because file paths can contain
 * `:`. A path containing the comment terminator would end the marker early
 * and corrupt the generated source, so such positions emit no marker at all.
 */
export const compilePositionMarker = (position: MarkerPosition): string => {
  if (position.file.includes('*/')) {
    return ''
  }

  return `/*@forge-pos:${JSON.stringify({ f: position.file, l: position.line, c: position.column })}*/`
}

export default class SourceRenderer {
  private readonly lines: string[] = []

  private readonly segmentsByLine: MarkerSegment[][] = []

  private readonly style: GeneratedCodeStyle

  private readonly preserveMarkers: boolean

  constructor(options: SourceRendererOptions = {}) {
    this.style = options.style ?? GeneratedCodeStyle.READABLE
    this.preserveMarkers = options.preserveMarkers ?? false
  }

  render(nodes: readonly CodeNode[]): RenderedSource {
    this.renderBody(nodes, 0)

    return { source: this.lines.join('\n'), segmentsByLine: this.segmentsByLine }
  }

  private renderBody(nodes: readonly CodeNode[], depth: number): void {
    nodes.forEach(node => this.renderNode(node, depth))
  }

  private renderNode(node: CodeNode, depth: number): void {
    switch (node.kind) {
      case CodeNodeKind.LINE:
        this.writeLine(node.text, depth)

        return
      case CodeNodeKind.BLANK_LINE:
        this.writeBlankLine()

        return
      case CodeNodeKind.COMMENT:
        this.writeCommentLine(node.text, depth)

        return
      case CodeNodeKind.BLOCK:
        this.writeBlock(node, depth)

        return
      case CodeNodeKind.TRY_CATCH:
        this.writeTryCatch(node, depth)

        return
      default:
        assertNever(node)
    }
  }

  private writeBlock(node: BlockNode, depth: number): void {
    if (node.open !== undefined) {
      this.writeLine(node.open, depth)
    }

    this.renderBody(node.body, depth + 1)

    if (node.close !== undefined) {
      this.writeLine(node.close, depth)
    }
  }

  private writeTryCatch(node: TryCatchNode, depth: number): void {
    this.writeLine('try {', depth)
    this.renderBody(node.tryBody, depth + 1)
    this.writeLine(`} catch (${node.errorName}) {`, depth)
    this.renderBody(node.catchBody, depth + 1)
    this.writeLine('}', depth)
  }

  private writeBlankLine(): void {
    if (this.style === GeneratedCodeStyle.COMPACT) {
      return
    }

    this.lines.push('')
    this.segmentsByLine.push([])
  }

  private writeCommentLine(text: string, depth: number): void {
    if (this.style === GeneratedCodeStyle.COMPACT) {
      return
    }

    this.writeLine(text, depth)
  }

  private writeLine(text: string, depth: number): void {
    const indent = this.style === GeneratedCodeStyle.COMPACT ? '' : '  '.repeat(depth)

    if (this.preserveMarkers) {
      this.lines.push(text.length === 0 ? '' : indent + text)
      this.segmentsByLine.push([])

      return
    }

    const segments: MarkerSegment[] = []
    const cleanText = stripMarkers(text, indent.length, segments)

    this.lines.push(cleanText.length === 0 ? '' : indent + cleanText)
    this.segmentsByLine.push(segments)
  }
}

const stripMarkers = (line: string, baseColumn: number, segments: MarkerSegment[]): string => {
  const matches = [...line.matchAll(MARKER_PATTERN)]

  if (matches.length === 0) {
    return line
  }

  let cleanLine = ''
  let cursor = 0

  matches.forEach(match => {
    cleanLine += line.slice(cursor, match.index)
    cursor = match.index + match[0].length

    const position = parseMarkerPosition(match[1])

    if (position !== undefined) {
      // Back-to-back markers (a node's author chain) strip to the same clean
      // column; nudge each subsequent segment right so every chain frame gets
      // its own bindable generated position and segments stay column-ordered.
      const previousColumn = segments.length === 0 ? -1 : segments[segments.length - 1].generatedColumn
      segments.push({ generatedColumn: Math.max(baseColumn + cleanLine.length, previousColumn + 1), position })
    }
  })

  return cleanLine + line.slice(cursor)
}

function assertNever(value: never): never {
  throw new Error(`Unhandled code node kind: ${String(value)}`)
}

const parseMarkerPosition = (json: string): MarkerPosition | undefined => {
  try {
    const parsed = JSON.parse(json) as { f?: unknown; l?: unknown; c?: unknown }

    if (typeof parsed.f !== 'string' || typeof parsed.l !== 'number' || typeof parsed.c !== 'number') {
      return undefined
    }

    return { file: parsed.f, line: parsed.l, column: parsed.c }
  } catch {
    return undefined
  }
}
