import { ASTNodeType } from '../../../contracts/ast/enums'
import { BlockType, ExpressionType } from '../../../../authoring/types/enums'
import { FieldBlockASTNode } from '../../../contracts/ast/structures.type'
import { IterateASTNode } from '../../../contracts/ast/expressions.type'
import { TemplateNode, TemplateValue } from '../../../contracts/ast/template.type'
import { StepFieldInventory } from '../../../contracts/plans/stepFieldInventory.type'
import FunctionRegistry from '../../../registries/FunctionRegistry'
import CodeEmitter from '../../emitters/CodeEmitter'
import FieldCodeEmitter from '../../emitters/FieldCodeEmitter'
import ExpressionDispatcher from '../../expressions/ExpressionDispatcher'
import { buildGeneratedSource, compileGeneratedFunction } from '../../function-construction/GeneratedFunctionCompiler'
import ScopedTemplateCompiler, { isTemplateFieldNode } from '../../structures/ScopedTemplateCompiler'
import type { CompilationDependencies } from '../../compilationDependencies.type'

export interface FieldInventoryContext {
  answers: Record<string, { current: unknown }>
  data: Record<string, unknown>
  session: Record<string, unknown>
  params: Record<string, unknown>
  query: Record<string, unknown>
  request: Record<string, unknown>
  conditions: FunctionRegistry
}

export interface FieldInventoryStepSource {
  stepId: string
  fieldBlocks: FieldBlockASTNode[]
  iterateNodes: IterateASTNode[]
  cleardownFieldCodes: string[]
}

export type CompiledFieldInventoryFunction = (
  ctx: FieldInventoryContext,
) => StepFieldInventory[] | Promise<StepFieldInventory[]>

/**
 * Compiles the possible field codes for each step in a navigation plan.
 *
 * Registered field codes are read from field blocks, including dynamic code
 * expressions. MAP iterator field codes are evaluated inline from templates
 * using the same iterator scope model as answer preparation, validation, and
 * render.
 */
export default class StepFieldInventoryCompiler {
  private readonly expr: ExpressionDispatcher

  private readonly fieldCodes: FieldCodeEmitter

  private readonly templates: ScopedTemplateCompiler

  constructor(dependencies: CompilationDependencies, sharedExpr?: ExpressionDispatcher) {
    this.expr = sharedExpr ?? new ExpressionDispatcher(dependencies)
    this.fieldCodes = new FieldCodeEmitter(this.expr)
    this.templates = new ScopedTemplateCompiler(this.expr)
  }

  /**
   * Builds a standalone generated inventory function for tests and diagnostics.
   */
  compile(steps: FieldInventoryStepSource[]): CompiledFieldInventoryFunction | undefined {
    return compileGeneratedFunction<CompiledFieldInventoryFunction>(this.expr, ['ctx'], () => this.buildSource(steps), {
      phase: 'field-inventory',
    })
  }

  /**
   * Produces inspectable generated source for tests and local debugging.
   */
  generateSource(steps: FieldInventoryStepSource[]): string {
    return buildGeneratedSource(this.expr, () => this.buildSource(steps))
  }

  /**
   * Emits inventory collection into an existing generated function.
   *
   * The caller owns the target array and expression dispatcher lifecycle; this
   * method only appends the per-step collection statements.
   */
  compileInto(steps: FieldInventoryStepSource[], emitter: CodeEmitter, fieldInventoryVar: string): void {
    steps.forEach(step => this.compileStep(step, emitter, fieldInventoryVar))
  }

  /**
   * Emits the full field inventory source, accumulating one inventory entry per step.
   */
  private buildSource(steps: FieldInventoryStepSource[]): string {
    const emitter = new CodeEmitter()

    emitter.code('"use strict";')

    emitter.comment('StepFieldInventoryCompiler.buildSource')
    emitter.declareConst('fieldInventory', '[]')

    this.compileInto(steps, emitter, 'fieldInventory')
    emitter.return('fieldInventory')

    return emitter.toString()
  }

  /**
   * Emits one step's static and iterator-derived field codes into a de-duplicated result.
   */
  private compileStep(step: FieldInventoryStepSource, emitter: CodeEmitter, fieldInventoryVar: string): void {
    emitter.comment('StepFieldInventoryCompiler.compileStep')
    emitter.scope(() => {
      const fieldCodesVar = emitter.const('fieldCodes', '[]')

      step.fieldBlocks.forEach(block => this.compileRegisteredFieldCode(block, fieldCodesVar, emitter))

      step.iterateNodes.forEach(iterateNode => {
        this.compileMapIterator(iterateNode, fieldCodesVar, emitter)
      })

      emitter.code(
        `${fieldInventoryVar}.push({ stepId: ${JSON.stringify(step.stepId)}, fieldCodes: Array.from(new Set(${fieldCodesVar})), cleardownFieldCodes: ${JSON.stringify(step.cleardownFieldCodes)} });`,
      )
    })
  }

  /**
   * Emits MAP iterator traversal only when its yield template can produce fields.
   */
  private compileMapIterator(iterateNode: IterateASTNode, codesVar: string, emitter: CodeEmitter): void {
    const template = iterateNode.properties.iterator.yieldTemplate

    if (template === undefined || !this.containsTemplateField(template)) {
      return
    }

    emitter.comment('StepFieldInventoryCompiler.compileMapIterator')
    this.templates.compileMapIterator(iterateNode, emitter, yieldTemplate => {
      this.compileTemplateInventory(yieldTemplate, codesVar, emitter)
    })
  }

  /**
   * Walks nested template values and emits field-code collection where field nodes appear.
   */
  private compileTemplateInventory(template: TemplateValue, codesVar: string, emitter: CodeEmitter): void {
    if (template === null || template === undefined || typeof template !== 'object') {
      return
    }

    if (this.expr.isTemplateNode(template)) {
      if (template.originalType === ASTNodeType.EXPRESSION && template.expressionType === ExpressionType.ITERATE) {
        this.compileTemplateMapIterator(template, codesVar, emitter)

        return
      }

      if (template.originalType === ASTNodeType.BLOCK && template.blockType === BlockType.FIELD) {
        this.compileTemplateFieldCode(template, codesVar, emitter)
      }

      Object.values(template.properties ?? {}).forEach(child => {
        this.compileTemplateInventory(child as TemplateValue, codesVar, emitter)
      })

      return
    }

    if (Array.isArray(template)) {
      template.forEach(item => {
        this.compileTemplateInventory(item, codesVar, emitter)
      })

      return
    }

    Object.values(template as Record<string, TemplateValue>).forEach(item => {
      this.compileTemplateInventory(item, codesVar, emitter)
    })
  }

  /**
   * Emits inventory collection for a nested MAP template using the shared iterator scope.
   */
  private compileTemplateMapIterator(templateNode: TemplateNode, codesVar: string, emitter: CodeEmitter): void {
    this.templates.compileTemplateMapIterator(templateNode, emitter, yieldTemplate => {
      this.compileTemplateInventory(yieldTemplate, codesVar, emitter)
    })
  }

  /**
   * Emits one template field's resolved code expression into the current code list.
   */
  private compileTemplateFieldCode(field: TemplateNode, codesVar: string, emitter: CodeEmitter): void {
    const codeExpr = this.templates.compileTemplateCodeExpression(field, emitter)

    if (codeExpr === undefined) {
      return
    }

    emitter.code(`${codesVar}.push(${codeExpr});`)
  }

  /**
   * Emits one registered field block's static or dynamic code expression.
   */
  private compileRegisteredFieldCode(block: FieldBlockASTNode, codesVar: string, emitter: CodeEmitter): void {
    const codeExpr = this.fieldCodes.compileRegisteredExpression(block.properties.code, emitter)

    if (codeExpr === undefined) {
      return
    }

    emitter.code(`${codesVar}.push(${codeExpr});`)
  }

  /**
   * Fast pre-check used to avoid emitting iterator loops for templates with no fields.
   */
  private containsTemplateField(template: TemplateValue): boolean {
    return this.templates.containsTemplateNode(template, isTemplateFieldNode)
  }
}
