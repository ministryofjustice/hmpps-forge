import { ASTNode } from '../../types/ast.type'
import { ASTNodeType } from '../../types/enums'
import { ExpressionType, FunctionType } from '../../../authoring/types/enums'
import { TemplateNode } from '../../types/template.type'
import { IteratorScopeFrame, NodeCompilationContext } from './node-compilers/types'
import ReferenceNodeCompiler from './node-compilers/ReferenceNodeCompiler'
import PredicateNodeCompiler from './node-compilers/PredicateNodeCompiler'
import PipelineNodeCompiler from './node-compilers/PipelineNodeCompiler'
import FormatNodeCompiler from './node-compilers/FormatNodeCompiler'
import ConditionalNodeCompiler from './node-compilers/ConditionalNodeCompiler'
import MatchNodeCompiler from './node-compilers/MatchNodeCompiler'
import FunctionRegistry from '../../registries/FunctionRegistry'

export type { IteratorScopeFrame } from './node-compilers/types'

export default class NodeCompilationDispatcher implements NodeCompilationContext {
  private functionRegistry: FunctionRegistry | undefined

  private usedAwait = false

  private readonly iteratorFrames: IteratorScopeFrame[] = []

  private readonly references = new ReferenceNodeCompiler(this)

  private readonly predicates = new PredicateNodeCompiler(this)

  private readonly pipelines = new PipelineNodeCompiler(this)

  private readonly formats = new FormatNodeCompiler(this)

  private readonly conditionals = new ConditionalNodeCompiler(this)

  private readonly matches = new MatchNodeCompiler(this)

  get iteratorStack(): readonly IteratorScopeFrame[] {
    return this.iteratorFrames
  }

  get iteratorDepth(): number {
    return this.iteratorFrames.length
  }

  get usesAwait(): boolean {
    return this.usedAwait
  }

  setFunctionRegistry(functionRegistry: FunctionRegistry | undefined): void {
    this.functionRegistry = functionRegistry
  }

  reset(): void {
    this.iteratorFrames.length = 0
    this.usedAwait = false
  }

  pushIteratorFrame(frame: IteratorScopeFrame): void {
    this.iteratorFrames.push(frame)
  }

  popIteratorFrame(): void {
    this.iteratorFrames.pop()
  }

  /**
   * Registered AST nodes and iterator template nodes share the same expression
   * compilers. Keeping the dispatch split here lets render, validation, answer
   * prep, reachability, and hooks all use one scope and async model.
   */
  compileExpression(node: ASTNode): string {
    if (!this.isCompilableNode(node)) {
      return JSON.stringify(node)
    }

    const properties = (node as unknown as { properties: Record<string, unknown> }).properties ?? {}

    if (node.type === ASTNodeType.PREDICATE) {
      const predicateType = (node as unknown as { predicateType: string }).predicateType

      return this.predicates.compile(predicateType, properties)
    }

    if (node.type === ASTNodeType.EXPRESSION) {
      return this.dispatchExpression((node as unknown as { expressionType: string }).expressionType, properties)
    }

    return 'undefined'
  }

  compileTemplateExpression(node: TemplateNode): string {
    const properties = (node.properties ?? {}) as Record<string, unknown>

    if (node.originalType === ASTNodeType.PREDICATE) {
      return this.predicates.compile(node.predicateType as string, properties)
    }

    if (node.originalType === ASTNodeType.EXPRESSION) {
      return this.dispatchExpression(node.expressionType as string, properties)
    }

    return 'undefined'
  }

  private dispatchExpression(expressionType: string, properties: Record<string, unknown>): string {
    switch (expressionType) {
      case ExpressionType.REFERENCE:
        return this.references.compile(properties)
      case ExpressionType.PIPELINE:
        return this.pipelines.compilePipeline(properties)
      case ExpressionType.FORMAT:
        return this.formats.compile(properties)
      case FunctionType.CONDITION:
      case FunctionType.TRANSFORMER:
      case FunctionType.GENERATOR:
        return this.pipelines.compileFunction(properties)
      case ExpressionType.CONDITIONAL:
        return this.conditionals.compile(properties)
      case ExpressionType.MATCH:
        return this.matches.compile(properties)
      default:
        return 'undefined'
    }
  }

  /**
   * Operands can be plain data, registered nodes, template nodes, or nested
   * containers containing any of those. Compiling them recursively here keeps
   * function arguments and block properties on the same rules.
   */
  compileOperand(value: unknown): string {
    if (this.isTemplateNode(value)) {
      return this.compileTemplateExpression(value)
    }

    if (this.isCompilableNode(value)) {
      return this.compileExpression(value as ASTNode)
    }

    if (Array.isArray(value)) {
      return `[${value.map(entry => this.compileOperand(entry)).join(', ')}]`
    }

    if (value !== null && value !== undefined && typeof value === 'object') {
      const properties = Object.entries(value as Record<string, unknown>)
        .map(([key, entry]) => `${JSON.stringify(key)}: ${this.compileOperand(entry)}`)

      return `({ ${properties.join(', ')} })`
    }

    if (value === undefined) {
      return 'undefined'
    }

    return JSON.stringify(value)
  }

  compileFunctionCall(funcName: string, argExprs: string[]): string {
    const callExpr = `ctx.conditions.get(${JSON.stringify(funcName)}).evaluate(${argExprs.join(', ')})`

    // Registry metadata is the source of truth for async user functions. Source
    // generation without a registry is used by narrow unit tests and preserves
    // sync output. With a registry, unknown entries are emitted as awaitable so
    // missing journey functions still fail at runtime lookup time.
    if (this.functionRegistry !== undefined && (this.functionRegistry.get(funcName)?.isAsync ?? true)) {
      this.usedAwait = true

      return `(await ${callExpr})`
    }

    return callExpr
  }

  namespaceToCtx(namespace: string): string {
    switch (namespace) {
      case 'data':
        return 'ctx.data'
      case 'session':
        return 'ctx.session'
      case 'params':
        return 'ctx.params'
      case 'query':
        return 'ctx.query'
      case 'request':
        return 'ctx.request'
      case 'post':
        return 'ctx.post'
      default:
        return `ctx[${JSON.stringify(namespace)}]`
    }
  }

  isCompilableNode(value: unknown): value is ASTNode {
    return value !== null &&
      value !== undefined &&
      typeof value === 'object' &&
      'type' in (value as Record<string, unknown>) &&
      'id' in (value as Record<string, unknown>) &&
      (value as Record<string, unknown>).type !== ASTNodeType.TEMPLATE
  }

  isTemplateNode(value: unknown): value is TemplateNode {
    return value !== null &&
      value !== undefined &&
      typeof value === 'object' &&
      (value as Record<string, unknown>).type === ASTNodeType.TEMPLATE
  }
}
