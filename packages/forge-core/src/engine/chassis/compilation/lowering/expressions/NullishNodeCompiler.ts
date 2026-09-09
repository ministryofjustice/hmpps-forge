import { CodeFragment, code } from '../codegen/fragments/CodeFragment'
import { NodeCompilationContext } from './types'

/** Compiles nullish coalescing with one primary evaluation and a lazy fallback. */
export default class NullishNodeCompiler {
  constructor(private readonly ctx: NodeCompilationContext) {}

  compile(properties: Record<string, unknown>): CodeFragment {
    const result = this.ctx.generator.let('nullishResult', this.ctx.compileOperandCode(properties.input))

    this.ctx.generator.if(code`${result} == null`, () => {
      this.ctx.generator.assign(result, this.ctx.compileOperandCode(properties.fallback))
    })

    return code`${result}`
  }
}
