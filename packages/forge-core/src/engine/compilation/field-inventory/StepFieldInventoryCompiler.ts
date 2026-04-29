import { ASTNodeType } from '../../types/enums'
import { BlockType, ExpressionType } from '../../../authoring/types/enums'
import { FieldBlockASTNode } from '../../types/structures.type'
import { IterateASTNode } from '../../types/expressions.type'
import { TemplateNode, TemplateValue } from '../../types/template.type'
import { StepFieldInventory } from '../../runtime/types/StepFieldInventory.type'
import FunctionRegistry from '../../registries/FunctionRegistry'
import CodeEmitter from '../codegen/CodeEmitter'
import NodeCompilationDispatcher from '../codegen/NodeCompilationDispatcher'
import { buildGeneratedSource, compileGeneratedFunction } from '../codegen/GeneratedFunctionCompiler'
import ScopedTemplateCompiler, { isTemplateFieldNode } from '../codegen/ScopedTemplateCompiler'

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
 * Compiles the possible field codes for each step in a reachability plan.
 *
 * Static field codes are read from registered field blocks. MAP iterator field
 * codes are evaluated inline from templates using the same iterator scope model
 * as answer preparation, validation, and render. The result lets navigation clear
 * unreachable answers without creating request-time AST nodes.
 */
export default class StepFieldInventoryCompiler {
  private readonly expr = new NodeCompilationDispatcher()

  private readonly templates = new ScopedTemplateCompiler(this.expr)

  compile(
    steps: FieldInventoryStepSource[],
    functionRegistry?: FunctionRegistry,
  ): CompiledFieldInventoryFunction | undefined {
    return compileGeneratedFunction<CompiledFieldInventoryFunction>(this.expr, ['ctx'], functionRegistry, () =>
      this.buildSource(steps),
    )
  }

  generateSource(steps: FieldInventoryStepSource[], functionRegistry?: FunctionRegistry): string {
    return buildGeneratedSource(this.expr, functionRegistry, () => this.buildSource(steps))
  }

  private buildSource(steps: FieldInventoryStepSource[]): string {
    const emitter = new CodeEmitter()

    emitter.emit('"use strict";')
    emitter.emit('var _result = [];')
    emitter.emitBlank()

    steps.forEach(step => {
      this.compileStep(step, emitter)
      emitter.emitBlank()
    })

    emitter.emit('return _result;')

    return emitter.toString()
  }

  private compileStep(step: FieldInventoryStepSource, emitter: CodeEmitter): void {
    const codesVar = emitter.nextVar('_codes')

    emitter.emit(`var ${codesVar} = [];`)

    step.fieldBlocks.forEach(block => {
      if (typeof block.properties.code === 'string') {
        emitter.emit(`${codesVar}.push(${JSON.stringify(block.properties.code)});`)
      }
    })

    step.iterateNodes.forEach(iterateNode => {
      this.compileMapIterator(iterateNode, codesVar, emitter)
    })

    emitter.emit(
      `_result.push({ stepId: ${JSON.stringify(step.stepId)}, fieldCodes: Array.from(new Set(${codesVar})), cleardownFieldCodes: ${JSON.stringify(step.cleardownFieldCodes)} });`,
    )
  }

  private compileMapIterator(iterateNode: IterateASTNode, codesVar: string, emitter: CodeEmitter): void {
    const template = iterateNode.properties.iterator.yieldTemplate

    if (template === undefined || !this.containsTemplateField(template)) {
      return
    }

    this.templates.compileMapIterator(iterateNode, emitter, yieldTemplate => {
      this.compileTemplateInventory(yieldTemplate, codesVar, emitter)
    })
  }

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

  private compileTemplateMapIterator(templateNode: TemplateNode, codesVar: string, emitter: CodeEmitter): void {
    this.templates.compileTemplateMapIterator(templateNode, emitter, yieldTemplate => {
      this.compileTemplateInventory(yieldTemplate, codesVar, emitter)
    })
  }

  private compileTemplateFieldCode(field: TemplateNode, codesVar: string, emitter: CodeEmitter): void {
    const codeExpr = this.templates.compileTemplateCodeExpression(field, emitter)

    if (codeExpr === undefined) {
      return
    }

    emitter.emit(`${codesVar}.push(${codeExpr});`)
  }

  private containsTemplateField(template: TemplateValue): boolean {
    return this.templates.containsTemplateNode(template, isTemplateFieldNode)
  }
}
