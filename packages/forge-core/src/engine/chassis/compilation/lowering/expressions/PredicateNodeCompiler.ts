import { PredicateType } from '../../../../../authoring/types/enums'
import { CodeFragment, arrayCode, code, literal } from '../codegen/fragments/CodeFragment'
import { isASTNode, isTemplateNode } from '../../../contracts/ast/nodes'
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
  compile(predicateType: string, properties: Record<string, unknown>, matchSubject?: CodeFragment): CodeFragment {
    switch (predicateType) {
      case PredicateType.TEST:
        return this.compileTest(properties, matchSubject)
      case PredicateType.AND:
        return this.compileLogical(properties, true, matchSubject)
      case PredicateType.OR:
        return this.compileLogical(properties, false, matchSubject)
      case PredicateType.NOT:
        return this.compileNot(properties, matchSubject)
      case PredicateType.XOR:
        return this.compileXor(properties, matchSubject)
      default:
        return literal(false)
    }
  }

  /** Applies a match's evaluated subject to each condition leaf in its predicate tree. */
  compileOperand(operand: unknown, matchSubject?: CodeFragment): CodeFragment {
    if (matchSubject === undefined) {
      return this.ctx.compileOperandCode(operand)
    }

    if (
      (isASTNode(operand) || isTemplateNode(operand)) &&
      'predicateType' in operand &&
      typeof operand.predicateType === 'string'
    ) {
      return this.compile(operand.predicateType, operand.properties ?? {}, matchSubject)
    }

    return this.ctx.compileOperandCode(operand)
  }

  /**
   * Compiles a TEST predicate by calling a registered condition function,
   * optionally wrapping the result in logical negation.
   */
  private compileTest(properties: Record<string, unknown>, matchSubject?: CodeFragment): CodeFragment {
    const subject = properties.subject
    const condition = properties.condition as Record<string, unknown> | undefined
    const negate = properties.negate === true

    if ((!matchSubject && !subject) || !condition) {
      return literal(false)
    }

    const conditionProps = (condition.properties ?? condition) as Record<string, unknown>
    const funcName = conditionProps.name as string
    const funcArgs = (conditionProps.arguments ?? []) as unknown[]
    const subjectExpr = matchSubject ?? this.ctx.compileOperandCode(subject)
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
    isAnd: boolean,
    matchSubject?: CodeFragment,
  ): CodeFragment {
    const operands = (properties.operands ?? []) as unknown[]

    if (operands.length === 0) {
      return literal(isAnd)
    }

    const result = this.ctx.generator.let('predicateResult', this.compileOperand(operands[0], matchSubject))

    operands.slice(1).forEach(operand => {
      const condition = isAnd ? code`${result}` : code`!${result}`

      this.ctx.generator.if(condition, () => {
        this.ctx.generator.assign(result, this.compileOperand(operand, matchSubject))
      })
    })

    return code`${result}`
  }

  /**
   * Emits logical negation around a nested predicate operand.
   */
  private compileNot(properties: Record<string, unknown>, matchSubject?: CodeFragment): CodeFragment {
    return code`(!(${this.compileOperand(properties.operand, matchSubject)}))`
  }

  /**
   * Counts truthy operands so XOR remains correct for more than two inputs.
   */
  private compileXor(properties: Record<string, unknown>, matchSubject?: CodeFragment): CodeFragment {
    const operands = (properties.operands ?? []) as unknown[]
    const compiled = operands.map(op => code`Boolean(${this.compileOperand(op, matchSubject)})`)

    return code`(${arrayCode(compiled)}.filter(Boolean).length === 1)`
  }
}
