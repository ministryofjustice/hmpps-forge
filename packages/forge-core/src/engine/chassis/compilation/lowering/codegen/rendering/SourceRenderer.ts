import AssignmentCodeNode from '../statements/AssignmentCodeNode'
import ArrayExpressionToken from '../fragments/ArrayExpressionToken'
import BlankLineCodeNode from '../statements/BlankLineCodeNode'
import BreakCodeNode from '../statements/BreakCodeNode'
import CallExpressionToken from '../fragments/CallExpressionToken'
import { CodeFragment, code, joinCode, nil } from '../fragments/CodeFragment'
import { SourcePosition } from '../SourcePosition.type'
import CommentCodeNode from '../statements/CommentCodeNode'
import ContinueCodeNode from '../statements/ContinueCodeNode'
import DeclarationCodeNode from '../statements/DeclarationCodeNode'
import DirectiveCodeNode from '../statements/DirectiveCodeNode'
import ExpressionCodeNode from '../statements/ExpressionCodeNode'
import ForRangeCodeNode from '../statements/ForRangeCodeNode'
import FunctionCodeNode from '../statements/FunctionCodeNode'
import FunctionExpressionToken from '../fragments/FunctionExpressionToken'
import CodeNode from '../statements/CodeNode'
import IfCodeNode from '../statements/IfCodeNode'
import ObjectExpressionToken from '../fragments/ObjectExpressionToken'
import PositionedCodeNode from '../statements/PositionedCodeNode'
import PositionedCodeToken from '../fragments/PositionedCodeToken'
import ReturnCodeNode from '../statements/ReturnCodeNode'
import ScopeCodeNode from '../statements/ScopeCodeNode'
import ThrowCodeNode from '../statements/ThrowCodeNode'
import TryCatchCodeNode from '../statements/TryCatchCodeNode'
import WhileCodeNode from '../statements/WhileCodeNode'

const MAX_READABLE_LINE_LENGTH = 120

/**
 * Renders the code-node tree (the intermediate representation built by `CodeGenerator`) into
 * JavaScript text and source-map segments in one pass.
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

  render(nodes: readonly CodeNode[]): RenderedSource {
    this.renderBody(nodes, 0, [])

    return { source: this.lines.join('\n'), segmentsByLine: this.segmentsByLine }
  }

  renderCode(value: CodeFragment): RenderedSource {
    this.writeCodeLine(value, 0)

    return { source: this.lines.join('\n'), segmentsByLine: this.segmentsByLine }
  }

  private renderBody(nodes: readonly CodeNode[], depth: number, inheritedPositions: readonly SourcePosition[]): void {
    nodes.forEach((node, index) => {
      this.renderGeneratedNode(node, depth, inheritedPositions)

      if (this.shouldSeparateNodes(node, nodes[index + 1])) {
        this.writeBlankLine()
      }
    })
  }

  private renderGeneratedNode(node: CodeNode, depth: number, positions: readonly SourcePosition[] = []): void {
    if (node instanceof PositionedCodeNode) {
      this.renderGeneratedNode(node.node, depth, [...node.positions, ...positions])

      return
    }

    const writeHeader = (value: CodeFragment): void => this.writeCodeLine(value, depth, positions)

    if (node instanceof DirectiveCodeNode) {
      writeHeader(code`${node.value};`)

      return
    }

    if (node instanceof DeclarationCodeNode) {
      const value = node.value === undefined ? nil : code` = ${node.value}`

      writeHeader(code`${CodeFragment.trusted(node.declarationKind)} ${node.name}${value};`)

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
      const asyncKeyword = node.async ? CodeFragment.trusted('async ') : nil

      writeHeader(code`${asyncKeyword}function ${node.name}(${joinCode(node.parameters)}) {`)
      this.renderBody(node.body, depth + 1, positions)
      this.writeCodeLine(code`}`, depth)

      return
    }

    if (node instanceof TryCatchCodeNode) {
      writeHeader(code`try {`)
      this.renderBody(node.tryBody, depth + 1, positions)
      this.writeCodeLine(code`} catch (${node.errorName}) {`, depth, positions)
      this.renderBody(node.catchBody, depth + 1, positions)
      this.writeCodeLine(code`}`, depth)

      return
    }

    throwUnhandledGeneratedNode(node)
  }

  private writeIf(node: IfCodeNode, depth: number, positions: readonly SourcePosition[]): void {
    node.branches.forEach((branch, index) => {
      const keyword = index === 0 ? CodeFragment.trusted('if') : CodeFragment.trusted('else if')
      const header = code`${keyword} (${branch.condition}) {`

      this.writeCodeLine(header, depth, positions)
      this.renderBody(branch.body, depth + 1, positions)
      this.writeCodeLine(code`}`, depth)
    })

    if (node.elseBody === undefined) {
      return
    }

    this.writeCodeLine(code`else {`, depth, positions)
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

  private writeCodeLine(value: CodeFragment, depth: number, fallbackPositions: readonly SourcePosition[] = []): void {
    const indentation = (lineDepth: number): string =>
      this.style === GeneratedCodeStyle.COMPACT ? '' : '  '.repeat(lineDepth)
    let currentDepth = depth
    let line = indentation(currentDepth)
    let segments: SourceMapSegment[] = []

    const flushLine = (nextDepth: number = currentDepth): void => {
      this.lines.push(line)
      this.segmentsByLine.push(segments)
      currentDepth = nextDepth
      line = indentation(currentDepth)
      segments = []
      fallbackPositions.forEach(writePosition)
    }

    const writePosition = (position: SourcePosition): void => {
      const previousColumn = segments.length === 0 ? -1 : segments[segments.length - 1].generatedColumn

      segments.push({ generatedColumn: Math.max(line.length, previousColumn + 1), position })
    }

    // Source maps treat the last preceding segment as active until the next one.
    // Writing the broad fallback positions first means a more precise position
    // from a nested token can override them for the actual executable range.
    fallbackPositions.forEach(writePosition)

    const renderItems = (
      items: CodeFragment['items'],
      inheritedPositions: readonly SourcePosition[],
      positionsAlreadyWritten = false,
    ): void => {
      let inheritedPositionsWritten = positionsAlreadyWritten

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
          flushLine(currentDepth)
          this.renderBody(
            item.body,
            currentDepth + 1,
            inheritedPositions.length > 0 ? inheritedPositions : fallbackPositions,
          )
          line += '}'

          return
        }

        if (item instanceof CallExpressionToken) {
          writeInheritedPositions()
          this.renderCallExpression(
            item,
            inheritedPositions,
            currentDepth,
            line.length,
            part => {
              line += part
            },
            flushLine,
            renderItems,
          )

          return
        }

        if (item instanceof ArrayExpressionToken) {
          writeInheritedPositions()
          this.renderArrayExpression(
            item,
            inheritedPositions,
            currentDepth,
            part => {
              line += part
            },
            flushLine,
            renderItems,
          )

          return
        }

        if (item instanceof ObjectExpressionToken) {
          writeInheritedPositions()
          this.renderObjectExpression(
            item,
            inheritedPositions,
            currentDepth,
            part => {
              line += part
            },
            flushLine,
            renderItems,
          )

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

  private renderCallExpression(
    token: CallExpressionToken,
    inheritedPositions: readonly SourcePosition[],
    depth: number,
    currentLineLength: number,
    write: (value: string) => void,
    flushLine: (nextDepth?: number) => void,
    renderItems: (
      items: CodeFragment['items'],
      positions: readonly SourcePosition[],
      positionsAlreadyWritten?: boolean,
    ) => void,
  ): void {
    renderItems(token.target.items, inheritedPositions, true)
    write('(')

    if (!this.shouldRenderCallAcrossLines(token, currentLineLength)) {
      token.args.forEach((arg, index) => {
        if (index > 0) {
          write(', ')
        }

        renderItems(arg.items, inheritedPositions, true)
      })
      write(')')

      return
    }

    flushLine(depth + 1)
    token.args.forEach((arg, index) => {
      renderItems(arg.items, inheritedPositions)

      if (index < token.args.length - 1) {
        write(',')
      }

      flushLine(index < token.args.length - 1 ? depth + 1 : depth)
    })
    write(')')
  }

  private renderArrayExpression(
    token: ArrayExpressionToken,
    inheritedPositions: readonly SourcePosition[],
    depth: number,
    write: (value: string) => void,
    flushLine: (nextDepth?: number) => void,
    renderItems: (
      items: CodeFragment['items'],
      positions: readonly SourcePosition[],
      positionsAlreadyWritten?: boolean,
    ) => void,
  ): void {
    write('[')

    if (!this.shouldRenderAcrossLines(token)) {
      token.values.forEach((value, index) => {
        if (index > 0) {
          write(', ')
        }

        renderItems(value.items, inheritedPositions, true)
      })
      write(']')

      return
    }

    flushLine(depth + 1)
    token.values.forEach((value, index) => {
      renderItems(value.items, inheritedPositions)

      if (index < token.values.length - 1) {
        write(',')
      }

      flushLine(index < token.values.length - 1 ? depth + 1 : depth)
    })
    write(']')
  }

  private renderObjectExpression(
    token: ObjectExpressionToken,
    inheritedPositions: readonly SourcePosition[],
    depth: number,
    write: (value: string) => void,
    flushLine: (nextDepth?: number) => void,
    renderItems: (
      items: CodeFragment['items'],
      positions: readonly SourcePosition[],
      positionsAlreadyWritten?: boolean,
    ) => void,
  ): void {
    if (!this.shouldRenderAcrossLines(token)) {
      const spacing = token.properties.length === 0 ? '' : ' '

      write(`{${spacing}`)
      token.properties.forEach((property, index) => {
        if (index > 0) {
          write(', ')
        }

        renderItems(property.key.items, inheritedPositions, true)
        write(': ')
        renderItems(property.value.items, inheritedPositions, true)
      })
      write(`${spacing}}`)

      return
    }

    write('{')
    flushLine(depth + 1)
    token.properties.forEach((property, index) => {
      renderItems(property.key.items, inheritedPositions)
      write(': ')
      renderItems(property.value.items, inheritedPositions, true)

      if (index < token.properties.length - 1) {
        write(',')
      }

      flushLine(index < token.properties.length - 1 ? depth + 1 : depth)
    })
    write('}')
  }

  private shouldRenderAcrossLines(token: ArrayExpressionToken | ObjectExpressionToken): boolean {
    if (this.style === GeneratedCodeStyle.COMPACT) {
      return false
    }

    if (token instanceof ArrayExpressionToken) {
      return token.values.some(value => this.containsLineStructure(value))
    }

    return token.properties.length > 2 || token.properties.some(property => this.containsLineStructure(property.value))
  }

  private shouldRenderCallAcrossLines(token: CallExpressionToken, currentLineLength: number): boolean {
    if (this.style === GeneratedCodeStyle.COMPACT) {
      return false
    }

    if (token.args.some(arg => this.containsLineStructure(arg))) {
      return true
    }

    if (this.containsLineStructure(token.target)) {
      return false
    }

    const argumentsLength = token.args.reduce((length, arg) => length + arg.toString().length, 0)
    const separatorsLength = Math.max(token.args.length - 1, 0) * 2
    const callLength = token.target.toString().length + argumentsLength + separatorsLength + 2

    return currentLineLength + callLength > MAX_READABLE_LINE_LENGTH
  }

  private containsLineStructure(value: CodeFragment): boolean {
    return value.items.some(item => {
      if (typeof item === 'string') {
        return item.includes('\n')
      }

      if (item instanceof FunctionExpressionToken) {
        return true
      }

      if (item instanceof CallExpressionToken) {
        return this.shouldRenderCallAcrossLines(item, 0)
      }

      if (item instanceof PositionedCodeToken) {
        return this.containsLineStructure(item.value)
      }

      if (item instanceof ArrayExpressionToken) {
        return item.values.some(arrayValue => this.containsLineStructure(arrayValue))
      }

      return item.properties.some(property => this.containsLineStructure(property.value))
    })
  }

  private shouldSeparateNodes(node: CodeNode, nextNode: CodeNode | undefined): boolean {
    if (this.style === GeneratedCodeStyle.COMPACT || nextNode === undefined) {
      return false
    }

    const current = this.unwrapPositionedNode(node)
    const next = this.unwrapPositionedNode(nextNode)

    if (next instanceof BlankLineCodeNode) {
      return false
    }

    if (current instanceof DeclarationCodeNode) {
      return !(next instanceof DeclarationCodeNode)
    }

    return current instanceof ForRangeCodeNode ||
      current instanceof IfCodeNode ||
      current instanceof TryCatchCodeNode ||
      current instanceof WhileCodeNode
  }

  private unwrapPositionedNode(node: CodeNode): CodeNode {
    return node instanceof PositionedCodeNode ? this.unwrapPositionedNode(node.node) : node
  }
}

function throwUnhandledGeneratedNode(value: CodeNode): never {
  throw new Error(`Unhandled generated code node: ${String(value)}`)
}
