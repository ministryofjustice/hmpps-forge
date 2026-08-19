import ForgeInternalError from '../../../../errors/ForgeInternalError'
import AssignmentCodeNode from './statements/AssignmentCodeNode'
import BlankLineCodeNode from './statements/BlankLineCodeNode'
import BreakCodeNode from './statements/BreakCodeNode'
import { CodeFragment, SafeCode } from './fragments/CodeFragment'
import CommentCodeNode from './statements/CommentCodeNode'
import ContinueCodeNode from './statements/ContinueCodeNode'
import DeclarationCodeNode, { DeclarationKind } from './statements/DeclarationCodeNode'
import DirectiveCodeNode from './statements/DirectiveCodeNode'
import ExpressionCodeNode from './statements/ExpressionCodeNode'
import ForRangeCodeNode from './statements/ForRangeCodeNode'
import FunctionCodeNode from './statements/FunctionCodeNode'
import FunctionExpressionToken from './fragments/FunctionExpressionToken'
import CodeNode from './statements/CodeNode'
import IfCodeNode, { IfCodeBranch } from './statements/IfCodeNode'
import IdentifierName from './fragments/IdentifierName'
import PositionedCodeNode from './statements/PositionedCodeNode'
import ReturnCodeNode from './statements/ReturnCodeNode'
import ScopeCodeNode from './statements/ScopeCodeNode'
import { SourcePosition } from './SourcePosition.type'
import ThrowCodeNode from './statements/ThrowCodeNode'
import TryCatchCodeNode from './statements/TryCatchCodeNode'
import WhileCodeNode from './statements/WhileCodeNode'

interface ScopeFrame {
  readonly names: Set<string>
}

interface NodeFrame {
  readonly body: CodeNode[]
}

export interface CodeGeneratorIfBranch {
  readonly condition: SafeCode
  readonly body: () => void
}

export interface FunctionOptions {
  readonly async?: boolean | (() => boolean)
}

/** Builds a tree of code nodes (statements, declarations, control flow)
 * that `SourceRenderer` later prints as JavaScript. Tracks variable names
 * and lexical scopes to avoid collisions in the generated output. */
export default class CodeGenerator {
  private readonly rootNodes: CodeNode[] = []

  private readonly nodeFrames: NodeFrame[] = [{ body: this.rootNodes }]

  private readonly functionNames: Set<string>

  private readonly scopeStack: ScopeFrame[]

  private variableCounter: number

  constructor(
    variableCounter = 0,
    functionNames: Set<string> = new Set(),
    scopeStack: ScopeFrame[] = [createScopeFrame()],
  ) {
    this.variableCounter = variableCounter
    this.functionNames = functionNames
    this.scopeStack = scopeStack
  }

  static forFunction(parameterPrefixes: readonly string[]): CodeGenerator {
    const parameters = parameterPrefixes.map(parameter => new IdentifierName(parameter))
    const parameterNames = new Set(parameters.map(parameter => parameter.value))

    return new CodeGenerator(0, parameterNames, [createScopeFrame(parameterNames)])
  }

  fork(): CodeGenerator {
    return new CodeGenerator(
      this.variableCounter,
      new Set(this.functionNames),
      this.scopeStack.map(frame => createScopeFrame(frame.names)),
    )
  }

  syncVariablesFrom(other: CodeGenerator): void {
    this.variableCounter = Math.max(this.variableCounter, other.variableCounter)
  }

  nextName(prefix = '_value'): IdentifierName {
    return new IdentifierName(`${prefix}${this.variableCounter++}`)
  }

  directive(value: string): void {
    this.currentBody.push(new DirectiveCodeNode(value))
  }

  var(prefix: string, value?: SafeCode): IdentifierName {
    const name = this.allocateFunctionName(prefix)

    this.currentBody.push(new DeclarationCodeNode(DeclarationKind.VAR, name, value))

    return name
  }

  declareVar(name: IdentifierName, value?: SafeCode): void {
    this.reserveFunctionName(name)
    this.currentBody.push(new DeclarationCodeNode(DeclarationKind.VAR, name, value))
  }

  let(prefix: string, value?: SafeCode): IdentifierName {
    const name = this.allocateLexicalName(prefix)

    this.currentBody.push(new DeclarationCodeNode(DeclarationKind.LET, name, value))

    return name
  }

  declareLet(name: IdentifierName, value?: SafeCode): void {
    this.reserveLexicalName(name)
    this.currentBody.push(new DeclarationCodeNode(DeclarationKind.LET, name, value))
  }

  const(prefix: string, value: SafeCode): IdentifierName {
    const name = this.allocateLexicalName(prefix)

    this.currentBody.push(new DeclarationCodeNode(DeclarationKind.CONST, name, value))

    return name
  }

  declareConst(name: IdentifierName, value: SafeCode): void {
    this.reserveLexicalName(name)
    this.currentBody.push(new DeclarationCodeNode(DeclarationKind.CONST, name, value))
  }

  assign(target: SafeCode, value: SafeCode): void {
    this.currentBody.push(new AssignmentCodeNode(target, value))
  }

  statement(expression: SafeCode): void {
    this.currentBody.push(new ExpressionCodeNode(expression))
  }

  return(value?: SafeCode): void {
    this.currentBody.push(new ReturnCodeNode(value))
  }

  throw(value: SafeCode): void {
    this.currentBody.push(new ThrowCodeNode(value))
  }

  break(): void {
    this.currentBody.push(new BreakCodeNode())
  }

  continue(): void {
    this.currentBody.push(new ContinueCodeNode())
  }

  if(condition: SafeCode, thenBody: () => void, elseBody?: () => void): void {
    this.ifChain([{ condition, body: thenBody }], elseBody)
  }

  ifChain(branches: readonly CodeGeneratorIfBranch[], elseBody?: () => void): void {
    if (branches.length === 0) {
      elseBody?.()

      return
    }

    const compiledBranches: IfCodeBranch[] = branches.map(branch => ({
      condition: branch.condition,
      body: this.captureLexicalBody(branch.body),
    }))
    const compiledElseBody = elseBody === undefined ? undefined : this.captureLexicalBody(elseBody)

    this.currentBody.push(new IfCodeNode(compiledBranches, compiledElseBody))
  }

  scope(body: () => void): void {
    this.currentBody.push(new ScopeCodeNode(this.captureLexicalBody(body)))
  }

  while(condition: SafeCode, body: () => void): void {
    this.currentBody.push(new WhileCodeNode(condition, this.captureLexicalBody(body)))
  }

  forRange(prefix: string, from: SafeCode, to: SafeCode, body: (index: IdentifierName) => void): IdentifierName {
    const loopBody: CodeNode[] = []

    this.scopeStack.push(createScopeFrame())
    this.nodeFrames.push({ body: loopBody })

    const index = this.allocateLexicalName(prefix)

    try {
      body(index)
    } finally {
      this.nodeFrames.pop()
      this.scopeStack.pop()
    }

    this.currentBody.push(new ForRangeCodeNode(index, from, to, loopBody))

    return index
  }

  tryCatch(tryBody: () => void, catchPrefix: string, catchBody: (error: IdentifierName) => void): IdentifierName {
    const compiledTryBody = this.captureLexicalBody(tryBody)
    const compiledCatchBody: CodeNode[] = []

    this.scopeStack.push(createScopeFrame())
    this.nodeFrames.push({ body: compiledCatchBody })

    const error = this.allocateLexicalName(catchPrefix)

    try {
      catchBody(error)
    } finally {
      this.nodeFrames.pop()
      this.scopeStack.pop()
    }

    this.currentBody.push(new TryCatchCodeNode(compiledTryBody, error, compiledCatchBody))

    return error
  }

  function(
    prefix: string,
    parameterPrefixes: readonly string[],
    buildBody: (generator: CodeGenerator, parameters: readonly IdentifierName[]) => void,
    options: FunctionOptions = {},
  ): IdentifierName {
    const name = this.allocateLexicalName(prefix)
    const functionGenerator = new CodeGenerator(this.variableCounter, new Set(), [createScopeFrame()])
    const parameters = parameterPrefixes.map(parameter => new IdentifierName(parameter))

    parameters.forEach(parameter => functionGenerator.reserveFunctionName(parameter))
    buildBody(functionGenerator, parameters)
    this.syncVariablesFrom(functionGenerator)
    const asyncFunction = resolveAsyncOption(options)
    this.currentBody.push(new FunctionCodeNode(name, parameters, [...functionGenerator.toNodes()], asyncFunction))

    return name
  }

  functionExpression(
    prefix: string | undefined,
    parameterPrefixes: readonly string[],
    buildBody: (generator: CodeGenerator, parameters: readonly IdentifierName[]) => void,
    options: FunctionOptions = {},
  ): CodeFragment {
    const name = prefix === undefined ? undefined : this.allocateFunctionName(prefix)
    const functionGenerator = new CodeGenerator(this.variableCounter, new Set(), [createScopeFrame()])
    const parameters = parameterPrefixes.map(parameter => new IdentifierName(parameter))

    parameters.forEach(parameter => functionGenerator.reserveFunctionName(parameter))
    buildBody(functionGenerator, parameters)
    this.syncVariablesFrom(functionGenerator)
    const asyncFunction = resolveAsyncOption(options)

    return CodeFragment.functionExpression(
      new FunctionExpressionToken(name, parameters, [...functionGenerator.toNodes()], asyncFunction),
    )
  }

  withSourcePositions(positions: readonly SourcePosition[], buildNodes: () => void): void {
    const nodes: CodeNode[] = []

    this.nodeFrames.push({ body: nodes })

    try {
      buildNodes()
    } finally {
      this.nodeFrames.pop()
    }

    nodes.forEach(node => this.currentBody.push(new PositionedCodeNode(node, positions)))
  }

  note(text: string): void {
    splitCommentLines(text).forEach(line => this.currentBody.push(new CommentCodeNode(line, false)))
  }

  comment(text: string): void {
    const previousNode = this.currentBody[this.currentBody.length - 1]

    if (previousNode !== undefined && !(previousNode instanceof BlankLineCodeNode)) {
      this.blank()
    }

    splitCommentLines(text).forEach(line => this.currentBody.push(new CommentCodeNode(line, true)))
  }

  blank(): void {
    this.currentBody.push(new BlankLineCodeNode())
  }

  toNodes(): readonly CodeNode[] {
    return this.rootNodes
  }

  private captureLexicalBody(body: () => void): CodeNode[] {
    const nodes: CodeNode[] = []

    this.scopeStack.push(createScopeFrame())
    this.nodeFrames.push({ body: nodes })

    try {
      body()
    } finally {
      this.nodeFrames.pop()
      this.scopeStack.pop()
    }

    return nodes
  }

  private allocateLexicalName(prefix: string): IdentifierName {
    return this.allocateName(
      prefix,
      name => this.isNameVisible(name),
      name => this.currentScope.names.add(name),
    )
  }

  private allocateFunctionName(prefix: string): IdentifierName {
    return this.allocateName(
      prefix,
      name => this.isNameVisible(name),
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
  ): IdentifierName {
    const baseName = new IdentifierName(prefix)

    if (!isUnavailable(baseName.value)) {
      reserve(baseName.value)

      return baseName
    }

    let suffix = 1
    let candidate = new IdentifierName(`${prefix}_${suffix}`)

    while (isUnavailable(candidate.value)) {
      suffix += 1
      candidate = new IdentifierName(`${prefix}_${suffix}`)
    }

    reserve(candidate.value)

    return candidate
  }

  private reserveLexicalName(name: IdentifierName): void {
    if (this.isNameVisible(name.value)) {
      throw new ForgeInternalError(`CodeGenerator: name "${name.value}" is already visible in this scope`)
    }

    this.currentScope.names.add(name.value)
  }

  private reserveFunctionName(name: IdentifierName): void {
    if (this.isNameVisible(name.value)) {
      throw new ForgeInternalError(`CodeGenerator: name "${name.value}" is already declared in this function`)
    }

    this.functionNames.add(name.value)
    this.rootScope.names.add(name.value)
  }

  private isNameVisible(name: string): boolean {
    return this.functionNames.has(name) || this.scopeStack.some(frame => frame.names.has(name))
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

const createScopeFrame = (names: Iterable<string> = []): ScopeFrame => ({ names: new Set(names) })

const splitCommentLines = (text: string): string[] => text.split(/\r\n|[\n\r\u2028\u2029]/)

const resolveAsyncOption = (options: FunctionOptions): boolean =>
  typeof options.async === 'function' ? options.async() : options.async === true
