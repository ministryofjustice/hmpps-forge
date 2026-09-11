import ForgeInternalError from '../../../../errors/ForgeInternalError'
import { IteratorType } from '../../../../../shared/taxonomy'
import type { IterationValue } from '../../../contracts/models/authoredValue.type'
import { CodeFragment, code, literal } from '../codegen/fragments/CodeFragment'
import IteratorLoopEmitter from '../emitters/IteratorLoopEmitter'
import type { NodeCompilationContext } from './types'

/** All iterator results share traversal, scope and budget accounting. */
export default class IteratorNodeCompiler {
  private readonly loops: IteratorLoopEmitter

  constructor(private readonly ctx: NodeCompilationContext) {
    this.loops = new IteratorLoopEmitter(ctx)
  }

  compile(value: IterationValue): CodeFragment {
    if (value.iterator === undefined) {
      return literal(undefined)
    }

    const generator = this.ctx.generator
    const result = generator.let('iteratorResult', this.initialValue(value.iterator))

    this.loops.compileLoop(value.input, generator, scope => {
      if (value.iterator === IteratorType.MAP) {
        const item =
          value.yieldTemplate === undefined ? literal(undefined) : this.ctx.compileValueCode(value.yieldTemplate)

        generator.statement(code`${result}.push(${item})`)

        return
      }

      const predicate = value.predicate === undefined ? literal(false) : this.ctx.compileValueCode(value.predicate)

      generator.if(value.iterator === IteratorType.EVERY ? code`!(${predicate})` : predicate, () => {
        switch (value.iterator) {
          case IteratorType.FILTER:
            generator.statement(code`${result}.push(${scope.rawItem})`)

            return
          case IteratorType.COUNT:
            generator.assign(result, code`${result} + 1`)

            return
          case IteratorType.FIND:
            generator.assign(result, scope.rawItem)
            generator.break()

            return
          case IteratorType.SOME:
          case IteratorType.EVERY:
            generator.assign(result, literal(value.iterator === IteratorType.SOME))
            generator.break()

            return
          default:
            throw new ForgeInternalError('Unsupported predicate iterator')
        }
      })
    })

    return code`${result}`
  }

  private initialValue(iterator: IteratorType): CodeFragment {
    switch (iterator) {
      case IteratorType.MAP:
      case IteratorType.FILTER:
        return code`[]`
      case IteratorType.COUNT:
        return literal(0)
      case IteratorType.SOME:
        return literal(false)
      case IteratorType.EVERY:
        return literal(true)
      case IteratorType.FIND:
        return literal(undefined)
      default: {
        const unsupported: never = iterator

        throw new ForgeInternalError(`Unsupported iterator: ${unsupported}`)
      }
    }
  }

}
