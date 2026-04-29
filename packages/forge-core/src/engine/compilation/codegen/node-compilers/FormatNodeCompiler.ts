import { NodeCompilationContext } from './types'

export default class FormatNodeCompiler {
  constructor(private readonly ctx: NodeCompilationContext) {}

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
