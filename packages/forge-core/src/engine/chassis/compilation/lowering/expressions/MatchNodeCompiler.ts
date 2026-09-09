import { CodeFragment, code, literal } from '../codegen/fragments/CodeFragment'
import IdentifierName from '../codegen/fragments/IdentifierName'
import { NodeCompilationContext } from './types'
import PredicateNodeCompiler from './PredicateNodeCompiler'

/** Compiles ordered branches against one evaluated subject, keeping branch operands and values lazy. */
export default class MatchNodeCompiler {
  constructor(private readonly ctx: NodeCompilationContext) {}

  /**
   * Binds the subject before emitting a first-match-wins conditional chain.
   */
  compile(properties: Record<string, unknown>): CodeFragment {
    const branches = (properties.branches ?? []) as Array<Record<string, unknown>>
    const otherwise = properties.otherwise
    const subject = this.ctx.generator.const('matchSubject', this.ctx.compileOperandCode(properties.subject))
    const result = this.ctx.generator.let('matchResult')

    this.compileBranch(branches, otherwise, result, code`${subject}`)

    return code`${result}`
  }

  private compileBranch(
    branches: readonly Record<string, unknown>[],
    otherwise: unknown,
    result: IdentifierName,
    subject: CodeFragment,
  ): void {
    const [branch, ...remainingBranches] = branches

    if (branch === undefined) {
      this.ctx.generator.assign(
        result,
        otherwise === undefined ? literal(undefined) : this.ctx.compileOperandCode(otherwise),
      )

      return
    }

    const predicate =
      'expected' in branch
        ? code`(${subject} === ${this.ctx.compileOperandCode(branch.expected)})`
        : new PredicateNodeCompiler(this.ctx).compileOperand(branch.predicate, subject)

    this.ctx.generator.if(
      predicate,
      () => this.ctx.generator.assign(result, this.ctx.compileOperandCode(branch.value)),
      () => this.compileBranch(remainingBranches, otherwise, result, subject),
    )
  }
}
