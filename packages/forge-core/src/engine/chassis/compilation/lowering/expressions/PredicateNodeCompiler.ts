import {
  AuthoredValueKind,
  type AuthoredValue,
  type PredicateValue,
} from '../../../contracts/models/authoredValue.type'
import { PredicateType } from '../../../../../shared/taxonomy'
import { CodeFragment, arrayCode, code, literal } from '../codegen/fragments/CodeFragment'
import { NodeCompilationContext } from './types'

/**
 * Compiles predicate nodes into boolean JavaScript expressions.
 *
 * Predicate nodes are shared across validation, reachability, rendering guards,
 * and hooks, so this compiler emits branch-local statements and delegates registered
 * condition function calls back through
 * the `ExpressionDispatcher`.
 */
export default class PredicateNodeCompiler {
  constructor(private readonly ctx: NodeCompilationContext) {}

  /**
   * Dispatches each predicate type (TEST, AND, OR, NOT, XOR) to its compiler.
   */
  compile(properties: PredicateValue, matchSubject?: CodeFragment): CodeFragment {
    switch (properties.predicate) {
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
  compileOperand(operand: AuthoredValue, matchSubject?: CodeFragment): CodeFragment {
    if (matchSubject === undefined) {
      return this.ctx.compileValueCode(operand)
    }

    if (operand.kind !== AuthoredValueKind.PREDICATE) {
      return this.ctx.compileValueCode(operand)
    }

    return this.compile(operand, matchSubject)
  }

  /**
   * Compiles a TEST predicate by calling a registered condition function,
   * optionally wrapping the result in logical negation.
   */
  private compileTest(properties: PredicateValue, matchSubject?: CodeFragment): CodeFragment {
    const subject = properties.subject
    const condition = properties.condition
    const negate = properties.negate === true

    if ((matchSubject === undefined && subject === undefined) || !condition) {
      return literal(false)
    }

    const funcName = condition.name
    const funcArgs = condition.arguments
    const subjectExpr =
      matchSubject ?? (subject === undefined ? literal(undefined) : this.ctx.compileValueCode(subject))
    const argExprs = funcArgs.map(arg => this.ctx.compileValueCode(arg))
    const callExpr = this.ctx.compileFunctionCallCode(funcName, [subjectExpr, ...argExprs], condition.source, {
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
  private compileLogical(properties: PredicateValue, isAnd: boolean, matchSubject?: CodeFragment): CodeFragment {
    const operands = properties.operands

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
  private compileNot(properties: PredicateValue, matchSubject?: CodeFragment): CodeFragment {
    return code`(!(${this.compileOperand(properties.operand, matchSubject)}))`
  }

  /**
   * Counts truthy operands so XOR remains correct for more than two inputs.
   */
  private compileXor(properties: PredicateValue, matchSubject?: CodeFragment): CodeFragment {
    const operands = properties.operands
    const compiled = operands.map(op => code`Boolean(${this.compileOperand(op, matchSubject)})`)

    return code`(${arrayCode(compiled)}.filter(Boolean).length === 1)`
  }
}
