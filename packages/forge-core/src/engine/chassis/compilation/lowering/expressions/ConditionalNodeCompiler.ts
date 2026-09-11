import type { ConditionalValue } from '../../../contracts/models/authoredValue.type'
import { CodeFragment, code } from '../codegen/fragments/CodeFragment'
import { NodeCompilationContext } from './types'

/** Compiles lazy value selection through the shared operand compiler. */
export default class ConditionalNodeCompiler {
  constructor(private readonly ctx: NodeCompilationContext) {}

  /**
   * Emits lazy branches so only the selected branch is evaluated at runtime.
   */
  compile(properties: ConditionalValue): CodeFragment {
    const result = this.ctx.generator.let('conditionalResult')
    const predicate = this.ctx.compileValueCode(properties.predicate)

    this.ctx.generator.if(
      predicate,
      () => this.ctx.generator.assign(result, this.ctx.compileValueCode(properties.thenValue)),
      () => this.ctx.generator.assign(result, this.ctx.compileValueCode(properties.elseValue)),
    )

    return code`${result}`
  }
}
