import { NodeCompilationContext } from './types'

export default class ConditionalNodeCompiler {
  constructor(private readonly ctx: NodeCompilationContext) {}

  compile(properties: Record<string, unknown>): string {
    const predExpr = this.ctx.compileOperand(properties.predicate)
    const thenExpr = this.ctx.compileOperand(properties.thenValue)
    const elseExpr = this.ctx.compileOperand(properties.elseValue)

    return `(${predExpr} ? ${thenExpr} : ${elseExpr})`
  }
}
