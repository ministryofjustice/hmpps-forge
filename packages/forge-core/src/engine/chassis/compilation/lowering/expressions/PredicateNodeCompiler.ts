import { PredicateType } from '../../../../../shared/taxonomy'
import { CodeFragment, arrayCode, code, literal } from '../codegen/fragments/CodeFragment'
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
  compile(predicateKind: string, properties: Record<string, unknown>): CodeFragment {
    switch (predicateKind) {
      case PredicateType.TEST:
        return this.compileTest(properties)
      case PredicateType.AND:
        return this.compileLogical(properties, true)
      case PredicateType.OR:
        return this.compileLogical(properties, false)
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

    const conditionProps = (condition.properties ?? condition) as Record<string, unknown>
    const funcName = conditionProps.name as string
    const funcArgs = (conditionProps.arguments ?? []) as unknown[]
    const [subjectExpr, ...argExprs] = [subject, ...funcArgs].map(arg => this.ctx.compileOperandCode(arg))
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
  private compileLogical(properties: Record<string, unknown>, isAnd: boolean): CodeFragment {
    const operands = (properties.operands ?? []) as unknown[]

    if (operands.length === 0) {
      return literal(isAnd)
    }

    const result = this.ctx.generator.let('predicateResult', this.ctx.compileOperandCode(operands[0]))

    operands.slice(1).forEach(operand => {
      const condition = isAnd ? code`${result}` : code`!${result}`

      this.ctx.generator.if(condition, () => {
        this.ctx.generator.assign(result, this.ctx.compileOperandCode(operand))
      })
    })

    return code`${result}`
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
    const compiled = operands.map(op => code`Boolean(${this.ctx.compileOperandCode(op)})`)

    return code`(${arrayCode(compiled)}.filter(Boolean).length === 1)`
  }
}
