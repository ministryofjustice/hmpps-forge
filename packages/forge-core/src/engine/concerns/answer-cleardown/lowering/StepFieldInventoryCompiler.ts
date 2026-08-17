import { ASTNodeType } from '../../../contracts/ast/enums'
import { BlockType, ExpressionType } from '../../../../authoring/types/enums'
import { FieldBlockASTNode } from '../../../contracts/ast/structures.type'
import { IterateASTNode } from '../../../contracts/ast/expressions.type'
import { TemplateNode, TemplateValue } from '../../../contracts/ast/template.type'
import { code, literal, objectCode } from '../../../compilation/codegen/Code'
import CodeGenerator from '../../../compilation/codegen/CodeGenerator'
import Name from '../../../compilation/codegen/Name'
import FieldCodeEmitter from '../../../compilation/lowering/emitters/FieldCodeEmitter'
import ExpressionDispatcher from '../../../compilation/lowering/expressions/ExpressionDispatcher'
import {
  compileGeneratedFunction,
  deriveScriptLabel,
  renderGeneratedSource,
} from '../../../compilation/lowering/function-construction/GeneratedFunctionCompiler'
import ScopedTemplateCompiler, {
  isTemplateFieldNode,
} from '../../../compilation/lowering/structures/ScopedTemplateCompiler'
import type { CompilationDependencies } from '../../../compilation/lowering/compilationDependencies.type'
import type { CompiledFieldInventoryFunction } from '../contracts/compiledFieldInventory.type'
import type { FieldInventoryStepSource } from '../../../contracts/plans/compilationPlan.type'

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
   * Builds the generated inventory function the cleardown phase and the
   * reachability projection read.
   */
  compile(steps: FieldInventoryStepSource[]): CompiledFieldInventoryFunction | undefined {
    const inventoryNodes = steps.flatMap(step => [...step.fieldBlocks, ...step.iterateNodes])

    return compileGeneratedFunction<CompiledFieldInventoryFunction>(this.expr, ['ctx'], () => this.buildSource(steps), {
      phase: 'field-inventory',
      label: deriveScriptLabel(inventoryNodes, { maxDepth: 1 }),
    })
  }

  /**
   * Produces inspectable generated source for tests and local debugging.
   */
  generateSource(steps: FieldInventoryStepSource[]): string {
    return renderGeneratedSource(this.expr, () => this.buildSource(steps))
  }

  /**
   * Emits the full field inventory source, accumulating one inventory entry per step.
   */
  private buildSource(steps: FieldInventoryStepSource[]): CodeGenerator {
    const generator = CodeGenerator.forFunction(['ctx'])

    generator.directive('use strict')

    generator.comment('StepFieldInventoryCompiler.buildSource')
    const fieldInventory = generator.const('fieldInventory', code`[]`)

    steps.forEach(step => this.compileStep(step, fieldInventory, generator))
    generator.return(fieldInventory)

    return generator
  }

  /**
   * Emits one step's static and iterator-derived field codes into a de-duplicated result.
   */
  private compileStep(step: FieldInventoryStepSource, fieldInventory: Name, generator: CodeGenerator): void {
    generator.comment('StepFieldInventoryCompiler.compileStep')
    generator.scope(() => {
      const fieldCodes = generator.const('fieldCodes', code`[]`)

      step.fieldBlocks.forEach(block => this.compileRegisteredFieldCode(block, fieldCodes, generator))

      step.iterateNodes.forEach(iterateNode => {
        this.compileMapIterator(iterateNode, fieldCodes, generator)
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

  /**
   * Emits MAP iterator traversal only when its yield template can produce fields.
   */
  private compileMapIterator(iterateNode: IterateASTNode, fieldCodes: Name, generator: CodeGenerator): void {
    const template = iterateNode.properties.iterator.yieldTemplate

    if (template === undefined || !this.containsTemplateField(template)) {
      return
    }

    generator.comment('StepFieldInventoryCompiler.compileMapIterator')
    this.templates.compileMapIterator(iterateNode, generator, yieldTemplate => {
      this.compileTemplateInventory(yieldTemplate, fieldCodes, generator)
    })
  }

  /**
   * Walks nested template values and emits field-code collection where field nodes appear.
   */
  private compileTemplateInventory(template: TemplateValue, fieldCodes: Name, generator: CodeGenerator): void {
    if (template === null || template === undefined || typeof template !== 'object') {
      return
    }

    if (this.expr.isTemplateNode(template)) {
      if (template.originalType === ASTNodeType.EXPRESSION && template.expressionType === ExpressionType.ITERATE) {
        this.compileTemplateMapIterator(template, fieldCodes, generator)

        return
      }

      if (template.originalType === ASTNodeType.BLOCK && template.blockType === BlockType.FIELD) {
        this.compileTemplateFieldCode(template, fieldCodes, generator)
      }

      Object.values(template.properties ?? {}).forEach(child => {
        this.compileTemplateInventory(child as TemplateValue, fieldCodes, generator)
      })

      return
    }

    if (Array.isArray(template)) {
      template.forEach(item => {
        this.compileTemplateInventory(item, fieldCodes, generator)
      })

      return
    }

    Object.values(template as Record<string, TemplateValue>).forEach(item => {
      this.compileTemplateInventory(item, fieldCodes, generator)
    })
  }

  /**
   * Emits inventory collection for a nested MAP template using the shared iterator scope.
   */
  private compileTemplateMapIterator(templateNode: TemplateNode, fieldCodes: Name, generator: CodeGenerator): void {
    this.templates.compileTemplateMapIterator(templateNode, generator, yieldTemplate => {
      this.compileTemplateInventory(yieldTemplate, fieldCodes, generator)
    })
  }

  /**
   * Emits one template field's resolved code expression into the current code list.
   */
  private compileTemplateFieldCode(field: TemplateNode, fieldCodes: Name, generator: CodeGenerator): void {
    const codeExpression = this.templates.compileTemplateCodeExpression(field, generator)

    if (codeExpression === undefined) {
      return
    }

    generator.statement(code`${fieldCodes}.push(${codeExpression})`)
  }

  /**
   * Emits one registered field block's static or dynamic code expression.
   */
  private compileRegisteredFieldCode(block: FieldBlockASTNode, fieldCodes: Name, generator: CodeGenerator): void {
    const codeExpression = this.fieldCodes.compileRegisteredExpression(block.properties.code, generator)

    if (codeExpression === undefined) {
      return
    }

    generator.statement(code`${fieldCodes}.push(${codeExpression})`)
  }

  /**
   * Fast pre-check used to avoid emitting iterator loops for templates with no fields.
   */
  private containsTemplateField(template: TemplateValue): boolean {
    return this.templates.containsTemplateNode(template, isTemplateFieldNode)
  }
}
