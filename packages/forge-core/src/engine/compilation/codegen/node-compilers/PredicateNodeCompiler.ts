import { PredicateType } from '../../../../authoring/types/enums'
import { NodeCompilationContext } from './types'

export default class PredicateNodeCompiler {
  constructor(private readonly ctx: NodeCompilationContext) {}

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
    const callExpr = this.ctx.compileFunctionCall(funcName, [subjectExpr, ...argExprs])

    if (negate) {
      return `!(${callExpr})`
    }

    return callExpr
  }

  private compileLogical(properties: Record<string, unknown>, operator: string, empty: string): string {
    const operands = (properties.operands ?? []) as unknown[]
    const compiled = operands.map(op => this.ctx.compileOperand(op))

    if (compiled.length === 0) {
      return empty
    }

    return `(${compiled.join(` ${operator} `)})`
  }

  private compileNot(properties: Record<string, unknown>): string {
    return `(!(${this.ctx.compileOperand(properties.operand)}))`
  }

  private compileXor(properties: Record<string, unknown>): string {
    const operands = (properties.operands ?? []) as unknown[]
    const compiled = operands.map(op => `Boolean(${this.ctx.compileOperand(op)})`)

    return `([${compiled.join(', ')}].filter(Boolean).length === 1)`
  }
}
