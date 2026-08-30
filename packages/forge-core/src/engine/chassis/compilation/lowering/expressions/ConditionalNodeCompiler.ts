import { CodeFragment, code } from '../codegen/fragments/CodeFragment'
import { NodeCompilationContext } from './types'

/**
 * Compiles authored conditional expressions into JavaScript expressions (not
 * statements). The result stays usable anywhere an operand is expected, such
 * as formatter arguments, block properties, validation messages, or hook
 * outcomes.
 */
export default class ConditionalNodeCompiler {
  constructor(private readonly ctx: NodeCompilationContext) {}

  /**
   * Emits a lazy ternary so only the selected branch is evaluated at runtime.
   */
  compile(properties: Record<string, unknown>): CodeFragment {
    const result = this.ctx.generator.let('conditionalResult')
    const predicate = this.ctx.compileOperandCode(properties.predicate)

    this.ctx.generator.if(
      predicate,
      () => this.ctx.generator.assign(result, this.ctx.compileOperandCode(properties.thenValue)),
      () => this.ctx.generator.assign(result, this.ctx.compileOperandCode(properties.elseValue)),
    )

    return code`${result}`
  }
}
