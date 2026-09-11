import type { NullishValue } from '../../../contracts/models/authoredValue.type'
import { CodeFragment, code } from '../codegen/fragments/CodeFragment'
import { NodeCompilationContext } from './types'

/** Compiles nullish coalescing with one primary evaluation and a lazy fallback. */
export default class NullishNodeCompiler {
  constructor(private readonly ctx: NodeCompilationContext) {}

  compile(properties: NullishValue): CodeFragment {
    const result = this.ctx.generator.let('nullishResult', this.ctx.compileValueCode(properties.input))

    this.ctx.generator.if(code`${result} == null`, () => {
      this.ctx.generator.assign(result, this.ctx.compileValueCode(properties.fallback))
    })

    return code`${result}`
  }
}
