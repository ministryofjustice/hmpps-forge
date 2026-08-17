import { CodeFragment, code, literal } from '../codegen/fragments/CodeFragment'
import CodeGenerator from '../codegen/CodeGenerator'
import IdentifierName from '../codegen/fragments/IdentifierName'
import ExpressionDispatcher from '../expressions/ExpressionDispatcher'
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
 * expression references resolve correctly. Both `RuntimeValueCompiler` and
 * `ScopedTemplateCompiler` delegate here.
 */
export default class IteratorLoopEmitter {
  constructor(private readonly expr: ExpressionDispatcher) {}

  compileLoop(input: unknown, generator: CodeGenerator, compileItem: (scope: IteratorEmitScope) => void): void {
    const inputName = generator.let('iteratorInput', this.expr.compileOperandCode(input))

    this.expr.compileNormalizeIteratorInput(inputName, generator)

    generator.if(code`Array.isArray(${inputName})`, () => {
      const indexName = generator.let('iteratorIndex', literal(0))

      generator.while(code`${indexName} < ${inputName}.length`, () => {
        const currentIndex = generator.const('currentIteratorIndex', indexName)
        const rawItem = generator.const('rawIteratorItem', code`${inputName}[${currentIndex}]`)

        generator.assign(indexName, code`${indexName} + 1`)
        generator.if(code`${rawItem} == null`, () => generator.continue())

        const item = generator.const('iteratorItem', this.expr.compileIteratorItemScopeExpression(rawItem))
        const inputLength = code`${inputName}.length`
        const scope: IteratorEmitScope = { input: inputName, index: currentIndex, item, rawItem, inputLength }
        const frame: IteratorScopeFrame = {
          itemVar: item,
          indexVar: currentIndex,
          inputLengthExpr: inputLength,
          rawItemExpr: rawItem,
        }

        this.expr.withIteratorFrame(frame, () => {
          compileItem(scope)
        })
      })
    })
  }

}
