import { CodeFragment, code, literal } from '../codegen/fragments/CodeFragment'
import CodeGenerator from '../codegen/CodeGenerator'
import IdentifierName from '../codegen/fragments/IdentifierName'
import type { AuthoredValue } from '../../../contracts/models/authoredValue.type'
import type { NodeCompilationContext } from '../expressions/types'
import { IteratorScopeFrame } from '../expressions/types'

/** The emitted loop's bindings, exposed to per-item compile callbacks. */
export interface IteratorEmitScope {
  readonly input: IdentifierName
  readonly index: IdentifierName
  readonly item: IdentifierName
  readonly rawItem: IdentifierName
  readonly inputLength: CodeFragment
}

/**
 * Emits the shared iterator loop that every phase compiler (the per-concern
 * code generators in lowering) uses. It normalises the input collection,
 * guards on arrays, walks with index/raw-item/item bindings, and runs the
 * per-item callback inside an iterator scope frame so `Item()` and `Loop()`
 * expression references resolve correctly. Both `IteratorNodeCompiler` and
 * `ScopedTemplateCompiler` delegate here.
 */
export default class IteratorLoopEmitter {
  constructor(private readonly expr: NodeCompilationContext) {}

  compileLoop(input: AuthoredValue, generator: CodeGenerator, compileItem: (scope: IteratorEmitScope) => void): void {
    const inputName = generator.let('iteratorInput', this.expr.compileValueCode(input, generator))
    const inputWasKeyedName = this.compileNormalizeIteratorInput(inputName, generator)

    generator.if(code`Array.isArray(${inputName})`, () => {
      const indexName = generator.let('iteratorIndex', literal(0))

      generator.while(code`${indexName} < ${inputName}.length`, () => {
        const currentIndex = generator.const('currentIteratorIndex', indexName)
        const rawItem = generator.const('rawIteratorItem', code`${inputName}[${currentIndex}]`)

        generator.assign(indexName, code`${indexName} + 1`)
        generator.statement(code`_forgeHelpers.consumeIteratorIteration(ctx)`)

        const item = generator.const('iteratorItem', code`${inputWasKeyedName} ? ${rawItem}[1] : ${rawItem}`)
        const inputLength = code`${inputName}.length`
        const scope: IteratorEmitScope = { input: inputName, index: currentIndex, item, rawItem, inputLength }
        const frame: IteratorScopeFrame = {
          itemVar: item,
          indexVar: currentIndex,
          inputLengthExpr: inputLength,
          inputWasKeyedVar: inputWasKeyedName,
          rawItemExpr: rawItem,
        }

        this.expr.withIteratorFrame(frame, () => {
          compileItem(scope)
        })
      })
    })
  }

  private compileNormalizeIteratorInput(input: IdentifierName, generator: CodeGenerator): IdentifierName {
    const keyed = generator.let('iteratorInputWasKeyed', literal(false))

    generator.if(code`${input} != null && !Array.isArray(${input}) && typeof ${input} === "object"`, () => {
      generator.assign(input, code`Object.entries(${input})`)
      generator.assign(keyed, literal(true))
    })

    return keyed
  }

}
