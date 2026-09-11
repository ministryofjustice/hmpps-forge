import {
  MatchBranchKind,
  type MatchValue,
  type MatchBranchValue,
  type AuthoredValue,
} from '../../../contracts/models/authoredValue.type'
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
  compile(properties: MatchValue): CodeFragment {
    const branches = properties.branches
    const otherwise = properties.otherwise
    const subject = this.ctx.generator.const('matchSubject', this.ctx.compileValueCode(properties.subject))
    const result = this.ctx.generator.let('matchResult')

    this.compileBranch(branches, otherwise, result, code`${subject}`)

    return code`${result}`
  }

  private compileBranch(
    branches: readonly MatchBranchValue[],
    otherwise: AuthoredValue | undefined,
    result: IdentifierName,
    subject: CodeFragment,
  ): void {
    const [branch, ...remainingBranches] = branches

    if (branch === undefined) {
      this.ctx.generator.assign(
        result,
        otherwise === undefined ? literal(undefined) : this.ctx.compileValueCode(otherwise),
      )

      return
    }

    const predicate =
      branch.kind === MatchBranchKind.CASE
        ? code`(${subject} === ${this.ctx.compileValueCode(branch.expected)})`
        : new PredicateNodeCompiler(this.ctx).compileOperand(branch.predicate, subject)

    this.ctx.generator.if(
      predicate,
      () => this.ctx.generator.assign(result, this.ctx.compileValueCode(branch.value)),
      () => this.compileBranch(remainingBranches, otherwise, result, subject),
    )
  }
}
