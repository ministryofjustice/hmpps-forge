import { PredicateType } from '../../../../../authoring/types/enums'
import { CodeFragment, arrayCode, code, joinCode, literal } from '../codegen/fragments/CodeFragment'
import { NodeCompilationContext } from './types'

/**
 * Compiles predicate nodes into boolean JavaScript expressions.
 *
 * Predicate nodes are shared across validation, reachability, rendering guards,
 * and hooks, so this compiler keeps the output as a pure expression (not
 * statements) and delegates registered condition function calls back through
 * the `ExpressionDispatcher`.
 */
export default class PredicateNodeCompiler {
  constructor(private readonly ctx: NodeCompilationContext) {}

  /**
   * Dispatches each predicate type (TEST, AND, OR, NOT, XOR) to its compiler.
   */
  compile(predicateType: string, properties: Record<string, unknown>): CodeFragment {
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
   * Compiles a TEST predicate by calling a registered condition function,
   * optionally wrapping the result in logical negation.
   */
  private compileTest(properties: Record<string, unknown>): CodeFragment {
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
    const callExpr = this.ctx.compileFunctionCallCode(funcName, [subjectExpr, ...argExprs], condition, {
      argumentPrefixes: ['subject', ...funcArgs.map((_, index) => `functionArgument${index + 1}`)],
    })

    if (negate) {
      return code`!(${callExpr})`
    }

    return callExpr
  }

  /**
   * Preserves JavaScript's short-circuit behaviour for AND and OR predicates.
   */
  private compileLogical(
    properties: Record<string, unknown>,
    operator: CodeFragment,
    empty: CodeFragment,
  ): CodeFragment {
    const operands = (properties.operands ?? []) as unknown[]
    // Operands after the first evaluate conditionally under short-circuiting,
    // so none of them may hoist call statements out of the expression.
    const compiled = this.ctx.withoutCallHoisting(() => operands.map(op => this.ctx.compileOperandCode(op)))

    if (compiled.length === 0) {
      return empty
    }

    return code`(${joinCode(compiled, operator)})`
  }

  /**
   * Emits logical negation around a nested predicate operand.
   */
  private compileNot(properties: Record<string, unknown>): CodeFragment {
    return code`(!(${this.ctx.compileOperandCode(properties.operand)}))`
  }

  /**
   * Counts truthy operands so XOR remains correct for more than two inputs.
   */
  private compileXor(properties: Record<string, unknown>): CodeFragment {
    const operands = (properties.operands ?? []) as unknown[]
    const compiled = this.ctx.withoutCallHoisting(() =>
      operands.map(op => code`Boolean(${this.ctx.compileOperandCode(op)})`),
    )

    return code`(${arrayCode(compiled)}.filter(Boolean).length === 1)`
  }
}
