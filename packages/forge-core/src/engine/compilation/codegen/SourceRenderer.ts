import AssignmentCodeNode from './AssignmentCodeNode'
import BlankLineCodeNode from './BlankLineCodeNode'
import BreakCodeNode from './BreakCodeNode'
import { Code, code, fallbackPositionedCode, joinCode, nil } from './Code'
import { SourcePosition } from './SourcePosition.type'
import CommentCodeNode from './CommentCodeNode'
import ContinueCodeNode from './ContinueCodeNode'
import DeclarationCodeNode from './DeclarationCodeNode'
import DirectiveCodeNode from './DirectiveCodeNode'
import ExpressionCodeNode from './ExpressionCodeNode'
import ForRangeCodeNode from './ForRangeCodeNode'
import FunctionCodeNode from './FunctionCodeNode'
import FunctionExpressionToken from './FunctionExpressionToken'
import GeneratedCodeNode from './GeneratedCodeNode'
import IfCodeNode from './IfCodeNode'
import PositionedCodeNode from './PositionedCodeNode'
import PositionedCodeToken from './PositionedCodeToken'
import ReturnCodeNode from './ReturnCodeNode'
import ScopeCodeNode from './ScopeCodeNode'
import ThrowCodeNode from './ThrowCodeNode'
import TryCatchCodeNode from './TryCatchCodeNode'
import WhileCodeNode from './WhileCodeNode'

/**
 * Renders generated-code IR into JavaScript and source-map segments in one pass.
 */

export interface SourceMapSegment {
  readonly generatedColumn: number
  readonly position: SourcePosition
}

export interface RenderedSource {
  readonly source: string
  readonly segmentsByLine: readonly (readonly SourceMapSegment[])[]
}

export enum GeneratedCodeStyle {
  READABLE = 'readable',
  COMPACT = 'compact',
}

export interface SourceRendererOptions {
  readonly style?: GeneratedCodeStyle
}

export default class SourceRenderer {
  private readonly lines: string[] = []

  private readonly segmentsByLine: SourceMapSegment[][] = []

  private readonly style: GeneratedCodeStyle

  constructor(options: SourceRendererOptions = {}) {
    this.style = options.style ?? GeneratedCodeStyle.READABLE
  }

  render(nodes: readonly GeneratedCodeNode[]): RenderedSource {
    this.renderBody(nodes, 0, [])

    return { source: this.lines.join('\n'), segmentsByLine: this.segmentsByLine }
  }

  renderCode(value: Code): RenderedSource {
    this.writeCodeLine(value, 0)

    return { source: this.lines.join('\n'), segmentsByLine: this.segmentsByLine }
  }

  private renderBody(
    nodes: readonly GeneratedCodeNode[],
    depth: number,
    inheritedPositions: readonly SourcePosition[],
  ): void {
    nodes.forEach(node => this.renderGeneratedNode(node, depth, inheritedPositions))
  }

  private renderGeneratedNode(node: GeneratedCodeNode, depth: number, positions: readonly SourcePosition[] = []): void {
    if (node instanceof PositionedCodeNode) {
      this.renderGeneratedNode(node.node, depth, [...node.positions, ...positions])

      return
    }

    const writeHeader = (value: Code): void => this.writeCodeLine(fallbackPositionedCode(value, positions), depth)

    if (node instanceof DirectiveCodeNode) {
      writeHeader(code`${node.value};`)

      return
    }

    if (node instanceof DeclarationCodeNode) {
      const value = node.value === undefined ? nil : code` = ${node.value}`

      writeHeader(code`${Code.trusted(node.declarationKind)} ${node.name}${value};`)

      return
    }

    if (node instanceof AssignmentCodeNode) {
      writeHeader(code`${node.target} = ${node.value};`)

      return
    }

    if (node instanceof ExpressionCodeNode) {
      writeHeader(code`${node.expression};`)

      return
    }

    if (node instanceof ReturnCodeNode) {
      const value = node.value === undefined ? nil : code` ${node.value}`

      writeHeader(code`return${value};`)

      return
    }

    if (node instanceof ThrowCodeNode) {
      writeHeader(code`throw ${node.value};`)

      return
    }

    if (node instanceof BreakCodeNode) {
      writeHeader(code`break;`)

      return
    }

    if (node instanceof ContinueCodeNode) {
      writeHeader(code`continue;`)

      return
    }

    if (node instanceof BlankLineCodeNode) {
      this.writeBlankLine()

      return
    }

    if (node instanceof CommentCodeNode) {
      this.writeCommentLine(node.banner ? `// --- ${node.text} ---` : `// ${node.text}`, depth)

      return
    }

    if (node instanceof ScopeCodeNode) {
      writeHeader(code`{`)
      this.renderBody(node.body, depth + 1, positions)
      this.writeCodeLine(code`}`, depth)

      return
    }

    if (node instanceof IfCodeNode) {
      this.writeIf(node, depth, positions)

      return
    }

    if (node instanceof WhileCodeNode) {
      writeHeader(code`while (${node.condition}) {`)
      this.renderBody(node.body, depth + 1, positions)
      this.writeCodeLine(code`}`, depth)

      return
    }

    if (node instanceof ForRangeCodeNode) {
      writeHeader(code`for (let ${node.index} = ${node.from}; ${node.index} < ${node.to}; ${node.index}++) {`)
      this.renderBody(node.body, depth + 1, positions)
      this.writeCodeLine(code`}`, depth)

      return
    }

    if (node instanceof FunctionCodeNode) {
      const asyncKeyword = node.async ? Code.trusted('async ') : nil

      writeHeader(code`${asyncKeyword}function ${node.name}(${joinCode(node.parameters)}) {`)
      this.renderBody(node.body, depth + 1, positions)
      this.writeCodeLine(code`}`, depth)

      return
    }

    if (node instanceof TryCatchCodeNode) {
      writeHeader(code`try {`)
      this.renderBody(node.tryBody, depth + 1, positions)
      this.writeCodeLine(fallbackPositionedCode(code`} catch (${node.errorName}) {`, positions), depth)
      this.renderBody(node.catchBody, depth + 1, positions)
      this.writeCodeLine(code`}`, depth)

      return
    }

    throwUnhandledGeneratedNode(node)
  }

  private writeIf(node: IfCodeNode, depth: number, positions: readonly SourcePosition[]): void {
    node.branches.forEach((branch, index) => {
      const keyword = index === 0 ? Code.trusted('if') : Code.trusted('else if')
      const header = code`${keyword} (${branch.condition}) {`

      this.writeCodeLine(fallbackPositionedCode(header, positions), depth)
      this.renderBody(branch.body, depth + 1, positions)
      this.writeCodeLine(code`}`, depth)
    })

    if (node.elseBody === undefined) {
      return
    }

    this.writeCodeLine(fallbackPositionedCode(code`else {`, positions), depth)
    this.renderBody(node.elseBody, depth + 1, positions)
    this.writeCodeLine(code`}`, depth)
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

    this.lines.push(text.length === 0 ? '' : indent + text)
    this.segmentsByLine.push([])
  }

  private writeCodeLine(value: Code, depth: number): void {
    const indent = this.style === GeneratedCodeStyle.COMPACT ? '' : '  '.repeat(depth)
    let line = indent
    let segments: SourceMapSegment[] = []

    const flushLine = (): void => {
      this.lines.push(line)
      this.segmentsByLine.push(segments)
      line = indent
      segments = []
    }

    const writePosition = (position: SourcePosition): void => {
      const previousColumn = segments.length === 0 ? -1 : segments[segments.length - 1].generatedColumn

      segments.push({ generatedColumn: Math.max(line.length, previousColumn + 1), position })
    }

    const renderItems = (items: Code['items'], inheritedPositions: readonly SourcePosition[]): void => {
      let inheritedPositionsWritten = false

      const writeInheritedPositions = (): void => {
        if (inheritedPositionsWritten) {
          return
        }

        inheritedPositions.forEach(writePosition)
        inheritedPositionsWritten = true
      }

      items.forEach(item => {
        if (item instanceof PositionedCodeToken) {
          renderItems(item.value.items, [...item.positions, ...inheritedPositions])

          return
        }

        if (item instanceof FunctionExpressionToken) {
          const asyncKeyword = item.async ? 'async ' : ''
          const functionName = item.name === undefined ? '' : ` ${item.name.value}`
          const parameters = item.parameters.map(parameter => parameter.value).join(', ')

          writeInheritedPositions()
          line += `${asyncKeyword}function${functionName}(${parameters}) {`
          flushLine()
          this.renderBody(item.body, depth + 1, inheritedPositions)
          line += '}'

          return
        }

        const parts = item.split('\n')

        parts.forEach((part, index) => {
          if (index > 0) {
            flushLine()
            inheritedPositionsWritten = false
          }

          if (part.length > 0) {
            writeInheritedPositions()
          }

          line += part
        })
      })
    }

    renderItems(value.items, [])

    flushLine()
  }
}

function throwUnhandledGeneratedNode(value: GeneratedCodeNode): never {
  throw new Error(`Unhandled generated code node: ${String(value)}`)
}
