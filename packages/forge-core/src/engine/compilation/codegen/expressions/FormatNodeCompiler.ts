import { NodeCompilationContext } from './types'

/**
 * Compiles positional format expressions such as "%1" replacement templates.
 * Replacements are emitted as callbacks so values containing String.replace
 * tokens are inserted literally rather than being interpreted by JavaScript.
 */
export default class FormatNodeCompiler {
  constructor(private readonly ctx: NodeCompilationContext) {}

  /**
   * Emits chained placeholder replacement while preserving multi-digit indexes.
   */
  compile(properties: Record<string, unknown>): string {
    const template = properties.template as string
    const formatArgs = (properties.arguments ?? []) as unknown[]
    const compiled = formatArgs.map(arg => this.ctx.compileOperand(arg))

    return compiled.reduce((result, argExpr, i) => {
      const placeholder = `%${i + 1}`
      const placeholderPattern = `${placeholder}(?!\\d)`

      return `${result}.replace(${new RegExp(placeholderPattern, 'g').toString()}, () => String(${argExpr} ?? ""))`
    }, JSON.stringify(template))
  }
}
