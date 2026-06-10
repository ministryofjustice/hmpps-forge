import { ASTNodeType } from '../../../contracts/ast/enums'
import { BlockType, ExpressionType } from '../../../../authoring/types/enums'
import { FieldBlockASTNode } from '../../../contracts/ast/structures.type'
import { IterateASTNode } from '../../../contracts/ast/expressions.type'
import { TemplateNode, TemplateValue } from '../../../contracts/ast/template.type'
import type { FieldInventoryStepSource } from '../../../contracts/plans/compilationPlan.type'
import type { CompiledStepFieldCodesFunction } from '../../../contracts/compiled/compiledFunctions.type'
import CodeEmitter from '../../emitters/CodeEmitter'
import FieldCodeEmitter from '../../emitters/FieldCodeEmitter'
import ExpressionDispatcher from '../../expressions/ExpressionDispatcher'
import { compileGeneratedFunction } from '../../function-construction/GeneratedFunctionCompiler'
import ScopedTemplateCompiler, { isTemplateFieldNode } from '../../structures/ScopedTemplateCompiler'
import type { CompilationDependencies } from '../../compilationDependencies.type'

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

  constructor(dependencies: CompilationDependencies) {
    this.expr = new ExpressionDispatcher(dependencies)
    this.fieldCodes = new FieldCodeEmitter(this.expr)
    this.templates = new ScopedTemplateCompiler(this.expr)
  }

  /**
   * Compiles one step's field-code collection into a standalone function
   * returning the de-duplicated codes. Returns undefined when the step has no
   * field blocks or iterator templates to collect from, in which case the step
   * inventories no codes.
   */
  compileStepFieldCodes(step: FieldInventoryStepSource): CompiledStepFieldCodesFunction | undefined {
    if (step.fieldBlocks.length === 0 && step.iterateNodes.length === 0) {
      return undefined
    }

    return compileGeneratedFunction<CompiledStepFieldCodesFunction>(
      this.expr,
      ['ctx'],
      () => this.buildStepFieldCodesSource(step),
      { phase: 'field-inventory' },
    )
  }

  /**
   * Emits one step's static and iterator-derived field codes into a
   * de-duplicated result.
   */
  private buildStepFieldCodesSource(step: FieldInventoryStepSource): string {
    const emitter = CodeEmitter.strict()

    emitter.comment('StepFieldInventoryCompiler.compileStepFieldCodes')
    emitter.declareConst('fieldCodes', '[]')

    step.fieldBlocks.forEach(block => this.compileRegisteredFieldCode(block, 'fieldCodes', emitter))

    step.iterateNodes.forEach(iterateNode => {
      this.compileMapIterator(iterateNode, 'fieldCodes', emitter)
    })

    emitter.return('Array.from(new Set(fieldCodes))')

    return emitter.toString()
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
