import { Code, code, literal } from '../../codegen/Code'
import { NodeCompilationContext } from './types'

/**
 * Compiles match expressions into a first-match-wins expression cascade.
 * Keeping this expression-shaped lets callers embed matches inside larger
 * generated values without introducing statement-level temporary variables.
 */
export default class MatchNodeCompiler {
  constructor(private readonly ctx: NodeCompilationContext) {}

  /**
   * Emits right-associated ternaries so earlier branches retain priority.
   */
  compile(properties: Record<string, unknown>): Code {
    const branches = (properties.branches ?? []) as Array<Record<string, unknown>>
    const otherwise = properties.otherwise

    const fallbackExpr = otherwise !== undefined ? this.ctx.compileOperandCode(otherwise) : literal(undefined)

    return branches.reduceRight<Code>((nextExpr, branch) => {
      const predicateExpr = this.ctx.compileOperandCode(branch.predicate)
      const valueExpr = this.ctx.compileOperandCode(branch.value)

      return code`(${predicateExpr} ? ${valueExpr} : ${nextExpr})`
    }, fallbackExpr)
  }
}
