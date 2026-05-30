import { PredicateType } from '../../../authoring/types/enums'
import { NodeCompilationContext } from './types'

/**
 * Compiles predicate nodes into boolean JavaScript expressions.
 *
 * Predicate nodes are shared across validation, reachability, rendering guards,
 * and hooks, so this compiler keeps the output expression-shaped and delegates
 * registered condition calls back through the shared context.
 */
export default class PredicateNodeCompiler {
  constructor(private readonly ctx: NodeCompilationContext) {}

  /**
   * Dispatches each authored predicate shape to its expression emitter.
   */
  compile(predicateType: string, properties: Record<string, unknown>): string {
    switch (predicateType) {
      case PredicateType.TEST:
        return this.compileTest(properties)
      case PredicateType.AND:
        return this.compileLogical(properties, '&&', 'true')
      case PredicateType.OR:
        return this.compileLogical(properties, '||', 'false')
      case PredicateType.NOT:
        return this.compileNot(properties)
      case PredicateType.XOR:
        return this.compileXor(properties)
      default:
        return 'false'
    }
  }

  /**
   * Emits a registered condition call, with optional predicate-level negation.
   */
  private compileTest(properties: Record<string, unknown>): string {
    const subject = properties.subject
    const condition = properties.condition as Record<string, unknown> | undefined
    const negate = properties.negate === true

    if (!subject || !condition) {
      return 'false'
    }

    const subjectExpr = this.ctx.compileOperand(subject)
    const conditionProps = (condition.properties ?? condition) as Record<string, unknown>
    const funcName = conditionProps.name as string
    const funcArgs = (conditionProps.arguments ?? []) as unknown[]
    const argExprs = funcArgs.map(arg => this.ctx.compileOperand(arg))
    const callExpr = this.ctx.compileFunctionCall(funcName, [subjectExpr, ...argExprs], condition)

    if (negate) {
      return `!(${callExpr})`
    }

    return callExpr
  }

  /**
   * Preserves JavaScript's short-circuit behaviour for AND and OR predicates.
   */
  private compileLogical(properties: Record<string, unknown>, operator: string, empty: string): string {
    const operands = (properties.operands ?? []) as unknown[]
    const compiled = operands.map(op => this.ctx.compileOperand(op))

    if (compiled.length === 0) {
      return empty
    }

    return `(${compiled.join(` ${operator} `)})`
  }

  /**
   * Emits logical negation around a nested predicate operand.
   */
  private compileNot(properties: Record<string, unknown>): string {
    return `(!(${this.ctx.compileOperand(properties.operand)}))`
  }

  /**
   * Counts truthy operands so XOR remains correct for more than two inputs.
   */
  private compileXor(properties: Record<string, unknown>): string {
    const operands = (properties.operands ?? []) as unknown[]
    const compiled = operands.map(op => `Boolean(${this.ctx.compileOperand(op)})`)

    return `([${compiled.join(', ')}].filter(Boolean).length === 1)`
  }
}
