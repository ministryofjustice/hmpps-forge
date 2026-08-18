import { IteratorType } from '../../../../../authoring/types/enums'
import { IterateASTNode } from '../../../contracts/ast/expressions.type'
import { isTemplateNode } from '../../../contracts/ast/nodes'
import { TemplateNode, TemplateValue } from '../../../contracts/ast/template.type'
import type { FieldModel, IterateRef } from '../../../contracts/models/fieldModel.type'
import { arrayCode, CodeFragment, code, literal } from '../codegen/fragments/CodeFragment'
import CodeGenerator from '../codegen/CodeGenerator'
import IdentifierName from '../codegen/fragments/IdentifierName'
import FieldCodeEmitter from '../emitters/FieldCodeEmitter'
import IteratorLoopEmitter, { IteratorEmitScope } from '../emitters/IteratorLoopEmitter'
import ExpressionDispatcher from '../expressions/ExpressionDispatcher'

interface TemplateMapIteratorProperties {
  readonly input?: unknown
  readonly iterator?: {
    readonly type?: unknown
    readonly yieldTemplate?: TemplateValue
  }
}

interface FieldOccurrenceOptions {
  readonly compileLeaf: (field: FieldModel) => void
  /** Emitted ahead of each top-level iterator loop, e.g. `Fields produced by an iterator`. */
  readonly loopComment?: string
}

interface FieldOccurrenceRun {
  readonly ref: IterateRef | undefined
  readonly fields: FieldModel[]
}

/**
 * Emits the iterator loop nesting that fields and blocks sit inside.
 *
 * Answer preparation, validation, field inventory, and resolve all need the
 * same MAP expansion behaviour: normalise input, enter `Item()`/`Loop()`
 * scope, and resolve dynamic field codes under that scope. The actual loop
 * body lives in `IteratorLoopEmitter`; this class reconstructs the nesting
 * structure from each field model's `iteratorPath` and the registered
 * iterate nodes.
 */
export default class ScopedTemplateCompiler {
  private readonly fieldCodes: FieldCodeEmitter

  private readonly loops: IteratorLoopEmitter

  constructor(private readonly expr: ExpressionDispatcher) {
    this.fieldCodes = new FieldCodeEmitter(expr)
    this.loops = new IteratorLoopEmitter(expr)
  }

  /**
   * Emits every field in model order, reconstructing the iterator loop nesting
   * from each field's `iteratorPath`. Consecutive fields sharing an iterator
   * path prefix share one emitted loop, so the generated code (and the runtime
   * evaluation order) matches the authored template structure.
   */
  compileFieldOccurrences(
    fields: readonly FieldModel[],
    generator: CodeGenerator,
    options: FieldOccurrenceOptions,
  ): void {
    this.compileFieldOccurrenceRuns(fields, 0, generator, options)
  }

  /**
   * Emits a registered MAP iterator node and compiles its yield template (the
   * per-item output shape) under iterator scope.
   */
  compileMapIterator(
    node: IterateASTNode,
    generator: CodeGenerator,
    compileYield: (template: TemplateValue, scope: IteratorEmitScope) => void,
  ): void {
    const yieldTemplate = node.properties.iterator.yieldTemplate

    if (node.properties.iterator.type !== IteratorType.MAP || yieldTemplate === undefined) {
      return
    }

    this.loops.compileLoop(node.properties.input, generator, scope => {
      compileYield(yieldTemplate, scope)
    })
  }

  /**
   * Resolves a template field code to generated source, including dynamic code expressions.
   */
  compileTemplateCodeExpression(
    node: TemplateNode,
    generator: CodeGenerator,
  ): CodeFragment | IdentifierName | undefined {
    return this.fieldCodes.compileTemplateExpression(node, generator)
  }

  /**
   * Emits the runtime block ID for one template node under the current iterator scope.
   */
  compileTemplateInstanceIdExpression(node: TemplateNode): CodeFragment {
    const prefix = `compiled:${String(node.id)}`
    const iteratorIndexes = this.expr.iteratorStack.map(frame => frame.indexVar)

    if (iteratorIndexes.length === 0) {
      return literal(prefix)
    }

    return code`${`${prefix}:`} + ${arrayCode(iteratorIndexes.map(index => code`${index}`))}.join(":")`
  }

  private compileFieldOccurrenceRuns(
    fields: readonly FieldModel[],
    depth: number,
    generator: CodeGenerator,
    options: FieldOccurrenceOptions,
  ): void {
    this.groupConsecutiveRuns(fields, depth).forEach(run => {
      if (run.ref === undefined) {
        run.fields.forEach(field => options.compileLeaf(field))

        return
      }

      if (depth === 0 && options.loopComment !== undefined) {
        generator.comment(options.loopComment)
      }

      const runRef = run.ref

      this.compileIterateRefLoop(runRef, generator, () => {
        this.compileFieldOccurrenceRuns(run.fields, depth + 1, generator, options)
      })
    })
  }

  private groupConsecutiveRuns(fields: readonly FieldModel[], depth: number): FieldOccurrenceRun[] {
    return fields.reduce<FieldOccurrenceRun[]>((runs, field) => {
      const ref = field.iteratorPath[depth]
      const lastRun = runs.at(-1)

      if (lastRun !== undefined && lastRun.ref?.node === ref?.node) {
        lastRun.fields.push(field)

        return runs
      }

      runs.push({ ref, fields: [field] })

      return runs
    }, [])
  }

  /** Emits one loop level for a registered or template MAP iterate node. */
  private compileIterateRefLoop(ref: IterateRef, generator: CodeGenerator, compileBody: () => void): void {
    const input = isTemplateNode(ref.node)
      ? ((ref.node.properties ?? {}) as TemplateMapIteratorProperties).input
      : ref.node.properties.input

    this.loops.compileLoop(input, generator, () => {
      compileBody()
    })
  }
}
