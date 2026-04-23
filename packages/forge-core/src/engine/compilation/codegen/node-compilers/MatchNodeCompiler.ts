import { NodeCompilationContext } from './types'

export default class MatchNodeCompiler {
  constructor(private readonly ctx: NodeCompilationContext) {}

  compile(properties: Record<string, unknown>): string {
    const branches = (properties.branches ?? []) as Array<Record<string, unknown>>
    const otherwise = properties.otherwise

    const fallbackExpr = otherwise !== undefined ? this.ctx.compileOperand(otherwise) : 'undefined'

    return branches.reduceRight((nextExpr, branch) => {
      const predicateExpr = this.ctx.compileOperand(branch.predicate)
      const valueExpr = this.ctx.compileOperand(branch.value)

      return `(${predicateExpr} ? ${valueExpr} : ${nextExpr})`
    }, fallbackExpr)
  }
}
