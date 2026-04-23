import { NodeCompilationContext } from './types'

export default class FormatNodeCompiler {
  constructor(private readonly ctx: NodeCompilationContext) {}

  compile(properties: Record<string, unknown>): string {
    const template = properties.template as string
    const formatArgs = (properties.arguments ?? []) as unknown[]
    const compiled = formatArgs.map(arg => this.ctx.compileOperand(arg))

    let result = JSON.stringify(template)

    compiled.forEach((argExpr, i) => {
      const placeholder = `%${i + 1}`

      result = `${result}.replace(${JSON.stringify(placeholder)}, String(${argExpr} ?? ""))`
    })

    return result
  }
}
