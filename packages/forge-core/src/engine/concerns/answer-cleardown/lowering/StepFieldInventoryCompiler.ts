import { code, literal, objectCode } from '../../../chassis/compilation/lowering/codegen/fragments/CodeFragment'
import { FieldCodeKind, type StaticFieldCode } from '../../../chassis/contracts/models/fieldModel.type'
import CodeGenerator from '../../../chassis/compilation/lowering/codegen/CodeGenerator'
import IdentifierName from '../../../chassis/compilation/lowering/codegen/fragments/IdentifierName'
import FieldCodeEmitter from '../../../chassis/compilation/lowering/emitters/FieldCodeEmitter'
import ExpressionDispatcher from '../../../chassis/compilation/lowering/expressions/ExpressionDispatcher'
import {
  CompilationPhase,
  compileGeneratedFunction,
  renderGeneratedSource,
} from '../../../chassis/compilation/lowering/GeneratedFunctionCompiler'
import ScopedTemplateCompiler from '../../../chassis/compilation/lowering/structures/ScopedTemplateCompiler'
import type { CompilationDependencies } from '../../../chassis/compilation/lowering/compilationDependencies.type'
import type { CleardownModel, CleardownStepModel } from '../contracts/cleardownModel.type'
import type { CompiledFieldInventoryFunction } from '../contracts/compiledFieldInventory.type'

/**
 * Compiles the possible field codes for each step in a journey's navigation plan.
 *
 * Static field codes come straight from field blocks, including dynamic code
 * expressions. Fields inside MAP iterators (repeating template sections) are
 * expanded inline using the same scoped-iteration model that answer preparation,
 * validation, and render use.
 */
export default class StepFieldInventoryCompiler {
  private readonly expr: ExpressionDispatcher

  private readonly fieldCodes: FieldCodeEmitter

  private readonly templates: ScopedTemplateCompiler

  constructor(dependencies: CompilationDependencies) {
    this.expr = new ExpressionDispatcher(dependencies)
    this.fieldCodes = new FieldCodeEmitter(this.expr)
    this.templates = new ScopedTemplateCompiler(this.expr)
  }

  /**
   * Builds the generated inventory function that the answer-cleardown phase
   * (which removes stale answers) and the reachability state projector both call
   * at runtime.
   */
  compile(model: CleardownModel): CompiledFieldInventoryFunction {
    return compileGeneratedFunction<CompiledFieldInventoryFunction>(this.expr, ['ctx'], () => this.buildSource(model), {
      phase: CompilationPhase.FIELD_INVENTORY,
      label: model.label,
    })
  }

  /** Produces inspectable generated source for tests and local debugging. */
  generateSource(model: CleardownModel): string {
    return renderGeneratedSource(this.expr, () => this.buildSource(model))
  }

  /** Emits the full field inventory source, accumulating one inventory entry per step. */
  private buildSource(model: CleardownModel): CodeGenerator {
    const generator = CodeGenerator.forFunction(['ctx'])

    generator.directive('use strict')

    generator.comment('Field inventory, one entry per step')
    const fieldInventory = generator.const('fieldInventory', code`[]`)

    model.steps.forEach(step => this.compileStep(step, fieldInventory, generator))
    generator.return(fieldInventory)

    return generator
  }

  /** Emits one step's static and iterator-expanded field codes into a de-duplicated result. */
  private compileStep(step: CleardownStepModel, fieldInventory: IdentifierName, generator: CodeGenerator): void {
    if (this.hasOnlyStaticFieldCodes(step)) {
      this.compileStaticStep(step, fieldInventory, generator)

      return
    }

    generator.comment("Collect one step's possible field codes")
    generator.scope(() => {
      const fieldCodes = generator.const('fieldCodes', code`[]`)

      this.templates.compileFieldOccurrences(step.fields, generator, {
        loopComment: 'Field codes produced by an iterator',
        compileLeaf: field => {
          const codeExpression = this.fieldCodes.compileModelExpression(field.code, generator)

          if (codeExpression === undefined) {
            return
          }

          generator.statement(code`${fieldCodes}.push(${codeExpression})`)
        },
      })

      generator.statement(
        code`${fieldInventory}.push(${objectCode([
          { key: 'stepId', value: literal(step.stepId) },
          { key: 'fieldCodes', value: code`Array.from(new Set(${fieldCodes}))` },
          { key: 'cleardownFieldCodes', value: literal(step.cleardownFieldCodes) },
        ])})`,
      )
    })
  }

  private hasOnlyStaticFieldCodes(step: CleardownStepModel): boolean {
    return step.fields.every(
      field =>
        field.iteratorPath.length === 0 && (field.code === undefined || field.code.kind === FieldCodeKind.STATIC),
    )
  }

  /** Emits a step whose field codes are all compile-time constants as one literal entry, deduplicated here. */
  private compileStaticStep(step: CleardownStepModel, fieldInventory: IdentifierName, generator: CodeGenerator): void {
    const staticFieldCodes = step.fields
      .map(field => field.code)
      .filter((fieldCode): fieldCode is StaticFieldCode => fieldCode?.kind === FieldCodeKind.STATIC)
      .map(fieldCode => fieldCode.value)

    generator.statement(
      code`${fieldInventory}.push(${objectCode([
        { key: 'stepId', value: literal(step.stepId) },
        { key: 'fieldCodes', value: literal([...new Set(staticFieldCodes)]) },
        { key: 'cleardownFieldCodes', value: literal(step.cleardownFieldCodes) },
      ])})`,
    )
  }
}
