import { PredicateType } from '../../../../authoring/types/enums'
import { Code, arrayCode, code, joinCode, literal } from '../../codegen/Code'
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
  compile(predicateType: string, properties: Record<string, unknown>): Code {
    switch (predicateType) {
      case PredicateType.TEST:
        return this.compileTest(properties)
      case PredicateType.AND:
        return this.compileLogical(properties, code` && `, literal(true))
      case PredicateType.OR:
        return this.compileLogical(properties, code` || `, literal(false))
      case PredicateType.NOT:
        return this.compileNot(properties)
      case PredicateType.XOR:
        return this.compileXor(properties)
      default:
        return literal(false)
    }
  }

  /**
   * Emits a registered condition call, with optional predicate-level negation.
   */
  private compileTest(properties: Record<string, unknown>): Code {
    const subject = properties.subject
    const condition = properties.condition as Record<string, unknown> | undefined
    const negate = properties.negate === true

    if (!subject || !condition) {
      return literal(false)
    }

    const subjectExpr = this.ctx.compileOperandCode(subject)
    const conditionProps = (condition.properties ?? condition) as Record<string, unknown>
    const funcName = conditionProps.name as string
    const funcArgs = (conditionProps.arguments ?? []) as unknown[]
    const argExprs = funcArgs.map(arg => this.ctx.compileOperandCode(arg))
    const callExpr = this.ctx.compileFunctionCallCode(funcName, [subjectExpr, ...argExprs], condition)

    if (negate) {
      return code`!(${callExpr})`
    }

    return callExpr
  }

  /**
   * Preserves JavaScript's short-circuit behaviour for AND and OR predicates.
   */
  private compileLogical(properties: Record<string, unknown>, operator: Code, empty: Code): Code {
    const operands = (properties.operands ?? []) as unknown[]
    const compiled = operands.map(op => this.ctx.compileOperandCode(op))

    if (compiled.length === 0) {
      return empty
    }

    return code`(${joinCode(compiled, operator)})`
  }

  /**
   * Emits logical negation around a nested predicate operand.
   */
  private compileNot(properties: Record<string, unknown>): Code {
    return code`(!(${this.ctx.compileOperandCode(properties.operand)}))`
  }

  /**
   * Counts truthy operands so XOR remains correct for more than two inputs.
   */
  private compileXor(properties: Record<string, unknown>): Code {
    const operands = (properties.operands ?? []) as unknown[]
    const compiled = operands.map(op => code`Boolean(${this.ctx.compileOperandCode(op)})`)

    return code`(${arrayCode(compiled)}.filter(Boolean).length === 1)`
  }
}
