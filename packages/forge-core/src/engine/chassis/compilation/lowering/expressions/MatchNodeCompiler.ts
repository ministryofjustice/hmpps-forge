import { CodeFragment, code, literal } from '../codegen/fragments/CodeFragment'
import IdentifierName from '../codegen/fragments/IdentifierName'
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
    const result = this.ctx.generator.let('matchResult')

    this.compileBranch(branches, otherwise, result)

    return code`${result}`
  }

  private compileBranch(
    branches: readonly Record<string, unknown>[],
    otherwise: unknown,
    result: IdentifierName,
  ): void {
    const [branch, ...remainingBranches] = branches

    if (branch === undefined) {
      this.ctx.generator.assign(
        result,
        otherwise === undefined ? literal(undefined) : this.ctx.compileOperandCode(otherwise),
      )

      return
    }

    const predicate = this.ctx.compileOperandCode(branch.predicate)

    this.ctx.generator.if(
      predicate,
      () => this.ctx.generator.assign(result, this.ctx.compileOperandCode(branch.value)),
      () => this.compileBranch(remainingBranches, otherwise, result),
    )
  }
}
