import { NodeCompilationContext } from './types'

/**
 * Compiles positional format expressions such as "%1" replacement templates.
 * Runtime helper replacement keeps values containing String.replace tokens
 * literal and leaves async operand evaluation in the surrounding function body.
 */
export default class FormatNodeCompiler {
  constructor(private readonly ctx: NodeCompilationContext) {}

  /**
   * Emits formatter arguments eagerly while preserving multi-digit indexes.
   */
  compile(properties: Record<string, unknown>): string {
    const template = properties.template as string
    const formatArgs = (properties.arguments ?? []) as unknown[]
    const compiled = formatArgs.map(arg => this.ctx.compileOperand(arg))
    const argsExpr = `[${compiled.join(', ')}]`

    return this.ctx.compileHelperCall('formatString', [JSON.stringify(template), argsExpr])
  }
}
