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
    // Only the selected branch evaluates, so call statements must not hoist
    // out of the ternary.
    return this.ctx.withoutCallHoisting(() => {
      const predExpr = this.ctx.compileOperandCode(properties.predicate)
      const thenExpr = this.ctx.compileOperandCode(properties.thenValue)
      const elseExpr = this.ctx.compileOperandCode(properties.elseValue)

      return code`(${predExpr} ? ${thenExpr} : ${elseExpr})`
    })
  }
}
