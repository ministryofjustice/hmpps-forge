import { CodeFragment, code, literal } from '../codegen/fragments/CodeFragment'
import { NodeCompilationContext } from './types'

/**
 * Compiles match expressions into a first-match-wins chain of ternaries.
 * The output is a pure JavaScript expression (not statements), so callers can
 * embed matches inside larger generated values without temporary variables.
 */
export default class MatchNodeCompiler {
  constructor(private readonly ctx: NodeCompilationContext) {}

  /**
   * Nests ternaries from right to left so earlier branches are checked first.
   */
  compile(properties: Record<string, unknown>): CodeFragment {
    const branches = (properties.branches ?? []) as Array<Record<string, unknown>>
    const otherwise = properties.otherwise

    // Only the first matching branch evaluates, so call statements must not
    // hoist out of the ternary chain.
    return this.ctx.withoutCallHoisting(() => {
      const fallbackExpr = otherwise !== undefined ? this.ctx.compileOperandCode(otherwise) : literal(undefined)

      return branches.reduceRight<CodeFragment>((nextExpr, branch) => {
        const predicateExpr = this.ctx.compileOperandCode(branch.predicate)
        const valueExpr = this.ctx.compileOperandCode(branch.value)

        return code`(${predicateExpr} ? ${valueExpr} : ${nextExpr})`
      }, fallbackExpr)
    })
  }
}
