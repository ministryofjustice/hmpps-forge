import { ASTNodeType } from '../../types/enums'
import { BlockType, ExpressionType, IteratorType } from '../../../authoring/types/enums'
import { FieldBlockASTNode } from '../../types/structures.type'
import { IterateASTNode } from '../../types/expressions.type'
import { TemplateNode, TemplateValue } from '../../types/template.type'
import { StepFieldInventory } from '../../runtime/types/StepFieldInventory.type'
import FunctionRegistry from '../../registries/FunctionRegistry'
import CodeEmitter from '../codegen/CodeEmitter'
import NodeCompilationDispatcher, { IteratorScopeFrame } from '../codegen/NodeCompilationDispatcher'
import { buildGeneratedSource, compileGeneratedFunction } from '../codegen/GeneratedFunctionCompiler'
import { emitIteratorItemScope, emitNormalizeIteratorInput } from '../codegen/iteratorCodegen'

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
    if (iterateNode.properties.iterator.type !== IteratorType.MAP) {
      return
    }

    const template = iterateNode.properties.iterator.yieldTemplate

    if (template === undefined || !this.containsTemplateField(template)) {
      return
    }

    const inputExpr = this.expr.compileOperand(iterateNode.properties.input)
    const inputVar = emitter.nextVar('_input')
    const indexVar = emitter.nextVar('_idx')
    const itemVar = emitter.nextVar('_item')
    const rawItemExpr = `${inputVar}[${indexVar}]`

    emitter.emit(`var ${inputVar} = ${inputExpr};`)
    emitNormalizeIteratorInput(emitter, inputVar)

    emitter.emitBlock(`if (Array.isArray(${inputVar}))`, () => {
      emitter.emitBlock(`for (var ${indexVar} = 0; ${indexVar} < ${inputVar}.length; ${indexVar}++)`, () => {
        emitter.emitBlock(`if (${inputVar}[${indexVar}] == null)`, () => {
          emitter.emit('continue;')
        })
        emitIteratorItemScope(emitter, inputVar, indexVar, itemVar)
        this.expr.pushIteratorFrame({ itemVar, indexVar, rawItemExpr })
        this.compileTemplateInventory(template, codesVar, emitter)
        this.expr.popIteratorFrame()
      })
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
    const properties = templateNode.properties ?? {}
    const iterator = properties.iterator as { type?: unknown; yieldTemplate?: TemplateValue } | undefined

    if (iterator?.type !== IteratorType.MAP || iterator.yieldTemplate === undefined) {
      return
    }

    const inputExpr = this.expr.compileOperand(properties.input)
    const inputVar = emitter.nextVar('_input')
    const indexVar = emitter.nextVar('_idx')
    const itemVar = emitter.nextVar('_item')
    const rawItemExpr = `${inputVar}[${indexVar}]`

    emitter.emit(`var ${inputVar} = ${inputExpr};`)
    emitNormalizeIteratorInput(emitter, inputVar)

    emitter.emitBlock(`if (Array.isArray(${inputVar}))`, () => {
      emitter.emitBlock(`for (var ${indexVar} = 0; ${indexVar} < ${inputVar}.length; ${indexVar}++)`, () => {
        emitter.emitBlock(`if (${inputVar}[${indexVar}] == null)`, () => {
          emitter.emit('continue;')
        })
        emitIteratorItemScope(emitter, inputVar, indexVar, itemVar)

        const frame: IteratorScopeFrame = { itemVar, indexVar, rawItemExpr }

        this.expr.pushIteratorFrame(frame)
        this.compileTemplateInventory(iterator.yieldTemplate as TemplateValue, codesVar, emitter)
        this.expr.popIteratorFrame()
      })
    })
  }

  private compileTemplateFieldCode(field: TemplateNode, codesVar: string, emitter: CodeEmitter): void {
    const code = field.properties?.code

    if (typeof code === 'string') {
      emitter.emit(`${codesVar}.push(${JSON.stringify(code)});`)

      return
    }

    if (!this.expr.isTemplateNode(code)) {
      return
    }

    const codeVar = emitter.nextVar('_code')
    const codeExpr = this.expr.compileTemplateExpression(code)

    emitter.emit(`var ${codeVar} = String(${codeExpr});`)
    emitter.emit(`${codesVar}.push(${codeVar});`)
  }

  private containsTemplateField(template: TemplateValue): boolean {
    if (template === null || template === undefined || typeof template !== 'object') {
      return false
    }

    if (this.expr.isTemplateNode(template)) {
      if (template.originalType === ASTNodeType.BLOCK && template.blockType === BlockType.FIELD) {
        return true
      }

      return Object.values(template.properties ?? {}).some(child => this.containsTemplateField(child as TemplateValue))
    }

    if (Array.isArray(template)) {
      return template.some(item => this.containsTemplateField(item))
    }

    return Object.values(template as Record<string, TemplateValue>).some(item => this.containsTemplateField(item))
  }

}
