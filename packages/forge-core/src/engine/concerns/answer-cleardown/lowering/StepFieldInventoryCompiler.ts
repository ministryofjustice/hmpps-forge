import { code, literal, objectCode } from '../../../compilation/codegen/Code'
import CodeGenerator from '../../../compilation/codegen/CodeGenerator'
import Name from '../../../compilation/codegen/Name'
import FieldCodeEmitter from '../../../compilation/lowering/emitters/FieldCodeEmitter'
import ExpressionDispatcher from '../../../compilation/lowering/expressions/ExpressionDispatcher'
import {
  CompilationPhase,
  compileGeneratedFunction,
  renderGeneratedSource,
} from '../../../compilation/lowering/function-construction/GeneratedFunctionCompiler'
import ScopedTemplateCompiler from '../../../compilation/lowering/structures/ScopedTemplateCompiler'
import type { CompilationDependencies } from '../../../compilation/lowering/compilationDependencies.type'
import type { CleardownModel, CleardownStepModel } from '../contracts/cleardownModel.type'
import type { CompiledFieldInventoryFunction } from '../contracts/compiledFieldInventory.type'

/**
 * Compiles the possible field codes for each step in a navigation plan.
 *
 * Registered field codes are read from field blocks, including dynamic code
 * expressions. MAP iterator field codes are evaluated inline from the model's
 * template occurrences using the same iterator scope model as answer
 * preparation, validation, and render.
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
   * Builds the generated inventory function the cleardown phase and the
   * reachability projection read.
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

  /** Emits one step's static and iterator-derived field codes into a de-duplicated result. */
  private compileStep(step: CleardownStepModel, fieldInventory: Name, generator: CodeGenerator): void {
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
}
