/**
 * Builder for the generated-source node tree.
 *
 * Generated code is intentionally inspectable because these compilers replace a
 * lot of request-time interpretation. The emitter owns statement structure and
 * collision-resistant naming; SourceRenderer owns indentation, comment policy,
 * and source-map positions at render time.
 */

import ForgeInternalError from '../../errors/ForgeInternalError'
import { BlockNode, CodeNode, CodeNodeKind } from './codeNode.type'
import SourceRenderer from './SourceRenderer'

interface ScopeFrame {
  readonly names: Set<string>
}

/** An open node body receiving emitted statements; indent-only frames come from `indent()`. */
interface NodeFrame {
  readonly body: CodeNode[]
  readonly indentOnly: boolean
}

export interface CodeEmitterIfBranch {
  readonly condition: string
  readonly body: () => void
}

export default class CodeEmitter {
  private readonly rootNodes: CodeNode[] = []

  private readonly nodeFrames: NodeFrame[] = [{ body: this.rootNodes, indentOnly: false }]

  private readonly functionNames: Set<string>

  private readonly scopeStack: ScopeFrame[]

  private hasEmittedLine = false

  private lastLineWasBlank = false

  private varCounter = 0

  constructor(varCounter = 0, functionNames: Set<string> = new Set(), scopeStack: ScopeFrame[] = [createScopeFrame()]) {
    this.varCounter = varCounter
    this.functionNames = functionNames
    this.scopeStack = scopeStack
  }

  fork(): CodeEmitter {
    return new CodeEmitter(
      this.varCounter,
      new Set(this.functionNames),
      this.scopeStack.map(frame => createScopeFrame(frame.names)),
    )
  }

  syncVariablesFrom(other: CodeEmitter): void {
    this.varCounter = Math.max(this.varCounter, other.varCounter)
  }

  /**
   * Prefixes are chosen by each compiler so the emitted source tells you which
   * part of the journey evaluation produced a temporary value.
   */
  nextVar(prefix = '_v'): string {
    return `${prefix}${this.varCounter++}`
  }

  var(prefix: string, rhs?: string): string {
    const name = this.allocateFunctionName(prefix)

    this.emitDeclaration('var', name, rhs)

    return name
  }

  declareVar(name: string, rhs?: string): void {
    this.reserveFunctionName(name)
    this.emitDeclaration('var', name, rhs)
  }

  let(prefix: string, rhs?: string): string {
    const name = this.allocateLexicalName(prefix)

    this.emitDeclaration('let', name, rhs)

    return name
  }

  declareLet(name: string, rhs?: string): void {
    this.reserveLexicalName(name)
    this.emitDeclaration('let', name, rhs)
  }

  const(prefix: string, rhs: string): string {
    const name = this.allocateLexicalName(prefix)

    this.emitDeclaration('const', name, rhs)

    return name
  }

  declareConst(name: string, rhs: string): void {
    this.reserveLexicalName(name)
    this.emitDeclaration('const', name, rhs)
  }

  assign(lhs: string, rhs: string): void {
    this.emit(`${lhs} = ${rhs};`)
  }

  if(condition: string, thenBody: () => void, elseBody?: () => void): void {
    this.emitBlock(`if (${condition})`, thenBody)

    if (elseBody === undefined) {
      return
    }

    this.emitBlock('else', elseBody)
  }

  /**
   * Emits a flat if / else-if / else chain without making callers build headers by hand.
   */
  ifChain(branches: readonly CodeEmitterIfBranch[], elseBody?: () => void): void {
    if (branches.length === 0) {
      elseBody?.()

      return
    }

    branches.forEach((branch, index) => {
      const keyword = index === 0 ? `if (${branch.condition})` : `else if (${branch.condition})`

      this.emitBlock(keyword, branch.body)
    })

    if (elseBody === undefined) {
      return
    }

    this.emitBlock('else', elseBody)
  }

  /**
   * Emits try / catch while keeping the catch binding in the catch block's lexical scope.
   */
  tryCatch(tryBody: () => void, catchPrefix: string, catchBody: (errorVar: string) => void): string {
    this.emitBlock('try', tryBody)

    const catchScope = createScopeFrame()

    this.scopeStack.push(catchScope)

    const errorVar = this.allocateLexicalName(catchPrefix)

    try {
      this.emitBraceBlock(`catch(${errorVar}) {`, () => catchBody(errorVar))
    } finally {
      this.scopeStack.pop()
    }

    return errorVar
  }

  scope(body: () => void): void {
    this.emitBraceBlock('{', () => this.withLexicalScope(body))
  }

  while(condition: string, body: () => void): void {
    this.emitBlock(`while (${condition})`, body)
  }

  forRange(prefix: string, from: string, to: string, body: (indexVar: string) => void): string {
    const scope = createScopeFrame()

    this.scopeStack.push(scope)

    const indexVar = this.allocateLexicalName(prefix)

    try {
      this.emitBraceBlock(`for (let ${indexVar} = ${from}; ${indexVar} < ${to}; ${indexVar}++) {`, () => body(indexVar))
    } finally {
      this.scopeStack.pop()
    }

    return indexVar
  }

  return(value: string): void {
    this.emit(`return ${value};`)
  }

  break(): void {
    this.emit('break;')
  }

  continue(): void {
    this.emit('continue;')
  }

  code(statement: string): void {
    this.emit(statement)
  }

  /**
   * Adds a generated-source breadcrumb that links emitted code back to a compiler method.
   */
  comment(text: string): void {
    if (this.hasEmittedLine && !this.lastLineWasBlank) {
      this.pushBlankLine()
    }

    text.split('\n').forEach(line => {
      this.pushRenderedNode({ kind: CodeNodeKind.COMMENT, text: `// --- ${line} ---` })
    })
  }

  emit(source: string): void {
    this.normalizeSourceLines(source).forEach(line => {
      if (line.length === 0) {
        this.pushBlankLine()

        return
      }

      this.pushRenderedNode({ kind: CodeNodeKind.LINE, text: line })
    })
  }

  emitBlank(): void {
    this.pushBlankLine()
  }

  /** Opens an indentation region without braces; paired with `dedent()`. */
  indent(): void {
    const region: BlockNode = { kind: CodeNodeKind.BLOCK, body: [] }

    this.currentBody.push(region)
    this.nodeFrames.push({ body: region.body, indentOnly: true })
  }

  dedent(): void {
    if (this.nodeFrames.length > 1 && this.nodeFrames[this.nodeFrames.length - 1].indentOnly) {
      this.nodeFrames.pop()
    }
  }

  /**
   * Centralises brace blocks so source generators can focus on evaluation
   * order instead of hand-building nested structure.
   */
  emitBlock(header: string, body: () => void): void {
    this.emitBraceBlock(`${header} {`, () => this.withLexicalScope(body))
  }

  /**
   * Renders with markers preserved: toString() output embeds into other
   * emitters or returns to the function compiler, and position markers must
   * survive until the final render resolves them into source-map segments.
   */
  toString(): string {
    return new SourceRenderer({ preserveMarkers: true }).render(this.rootNodes).source
  }

  toNodes(): readonly CodeNode[] {
    return this.rootNodes
  }

  private emitBraceBlock(open: string, body: () => void): void {
    const block: BlockNode = { kind: CodeNodeKind.BLOCK, open, close: '}', body: [] }

    this.pushRenderedNode(block)
    this.nodeFrames.push({ body: block.body, indentOnly: false })

    try {
      body()
    } finally {
      this.nodeFrames.pop()
      this.hasEmittedLine = true
      this.lastLineWasBlank = false
    }
  }

  private pushRenderedNode(node: CodeNode): void {
    this.currentBody.push(node)
    this.hasEmittedLine = true
    this.lastLineWasBlank = false
  }

  private pushBlankLine(): void {
    this.currentBody.push({ kind: CodeNodeKind.BLANK_LINE })
    this.hasEmittedLine = true
    this.lastLineWasBlank = true
  }

  private emitDeclaration(kind: 'const' | 'let' | 'var', name: string, rhs?: string): void {
    if (rhs === undefined) {
      this.emit(`${kind} ${name};`)

      return
    }

    this.emit(`${kind} ${name} = ${rhs};`)
  }

  private allocateLexicalName(prefix: string): string {
    return this.allocateName(
      prefix,
      name => {
        return this.isNameVisible(name)
      },
      name => {
        this.currentScope.names.add(name)
      },
    )
  }

  private allocateFunctionName(prefix: string): string {
    return this.allocateName(
      prefix,
      name => {
        return this.isNameVisible(name)
      },
      name => {
        this.functionNames.add(name)
        this.rootScope.names.add(name)
      },
    )
  }

  private allocateName(
    prefix: string,
    isUnavailable: (name: string) => boolean,
    reserve: (name: string) => void,
  ): string {
    if (!isUnavailable(prefix)) {
      reserve(prefix)

      return prefix
    }

    let suffix = 1
    let candidate = `${prefix}_${suffix}`

    while (isUnavailable(candidate)) {
      suffix += 1
      candidate = `${prefix}_${suffix}`
    }

    reserve(candidate)

    return candidate
  }

  private reserveLexicalName(name: string): void {
    if (this.isNameVisible(name)) {
      throw new ForgeInternalError(`CodeEmitter: name "${name}" is already visible in this scope`)
    }

    this.currentScope.names.add(name)
  }

  private reserveFunctionName(name: string): void {
    if (this.isNameVisible(name)) {
      throw new ForgeInternalError(`CodeEmitter: name "${name}" is already declared in this function`)
    }

    this.functionNames.add(name)
    this.rootScope.names.add(name)
  }

  private isNameVisible(name: string): boolean {
    if (this.functionNames.has(name)) {
      return true
    }

    return this.scopeStack.some(frame => frame.names.has(name))
  }

  private withLexicalScope(body: () => void): void {
    this.scopeStack.push(createScopeFrame())

    try {
      body()
    } finally {
      this.scopeStack.pop()
    }
  }

  private normalizeSourceLines(source: string): string[] {
    const lines = source.split('\n')
    const commonIndent = this.resolveCommonIndent(lines)

    if (commonIndent === 0) {
      return lines
    }

    return lines.map(line => line.slice(Math.min(commonIndent, countLeadingWhitespace(line))))
  }

  private resolveCommonIndent(lines: string[]): number {
    const allLineIndent = getCommonIndent(lines)

    if (allLineIndent > 0) {
      return allLineIndent
    }

    if (lines.length <= 1 || lines[0].trim() === '') {
      return 0
    }

    return getCommonIndent(lines.slice(1))
  }

  private get currentBody(): CodeNode[] {
    return this.nodeFrames[this.nodeFrames.length - 1].body
  }

  private get rootScope(): ScopeFrame {
    return this.scopeStack[0]
  }

  private get currentScope(): ScopeFrame {
    return this.scopeStack[this.scopeStack.length - 1]
  }
}

function createScopeFrame(names: Iterable<string> = []): ScopeFrame {
  return {
    names: new Set(names),
  }
}

function getCommonIndent(lines: string[]): number {
  const indents = lines
    .filter(line => line.trim().length > 0)
    .map(countLeadingWhitespace)

  if (indents.length === 0) {
    return 0
  }

  return Math.min(...indents)
}

function countLeadingWhitespace(line: string): number {
  return line.match(/^\s*/)?.[0].length ?? 0
}
