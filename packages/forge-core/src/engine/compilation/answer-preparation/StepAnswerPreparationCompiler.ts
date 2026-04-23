import { ASTNodeType } from '../../types/enums'
import { BlockType, ExpressionType, FunctionType, IteratorType } from '../../../authoring/types/enums'
import { FieldBlockASTNode } from '../../types/structures.type'
import { IterateASTNode } from '../../types/expressions.type'
import { TemplateNode, TemplateValue } from '../../types/template.type'
import { isASTNode } from '../../typeguards/nodes'
import FunctionRegistry from '../../registries/FunctionRegistry'
import CodeEmitter from '../codegen/CodeEmitter'
import NodeCompilationDispatcher, { IteratorScopeFrame } from '../codegen/NodeCompilationDispatcher'
import { buildGeneratedSource, compileGeneratedFunction } from '../codegen/GeneratedFunctionCompiler'
import { emitIteratorItemScope, emitNormalizeIteratorInput } from '../codegen/iteratorCodegen'

/**
 * Runtime context passed to the compiled answer preparation function.
 *
 * Answer preparation mutates ctx.answers in place. That is intentional: hooks,
 * validation, reachability, and render all run against the same request context
 * and need to observe the same answer history.
 */
export interface AnswerPreparationContext {
  answers: Record<string, { current: unknown; mutations: { value: unknown; source: string }[] }>
  data: Record<string, unknown>
  session: Record<string, unknown>
  params: Record<string, unknown>
  query: Record<string, unknown>
  request: Record<string, unknown>
  conditions: FunctionRegistry
  scope: Record<string, unknown>[]
  post: Record<string, string | string[]>
}

export type CompiledAnswerPreparationFunction = (ctx: AnswerPreparationContext) => void | Promise<void>

/**
 * Compiles GET/POST answer preparation for a step or journey-root plan.
 *
 * The generated function is imperative because answer preparation is inherently
 * sequential: raw POST value, multiple handling, formatter pipeline,
 * dependentWhen, and defaultValue must update AnswerHistory in order. Formatter
 * calls receive the current value as an explicit first argument, matching the
 * author-facing formatter contract with no extra request-time wrapper state.
 *
 * Static fields compile from FieldBlockASTNodes. MAP iterator fields compile from
 * their templates and run inline over the iterator input. Registry metadata keeps
 * sync-only functions as normal Functions and switches only async-dependent source
 * to AsyncFunction.
 *
 * compile() returns undefined only when source generation fails; runtime callers
 * fail fast when the generated function is unavailable.
 */
export default class StepAnswerPreparationCompiler {
  private readonly expr = new NodeCompilationDispatcher()

  compile(
    fieldBlocks: FieldBlockASTNode[],
    iterateNodes: IterateASTNode[] = [],
    functionRegistry?: FunctionRegistry,
  ): CompiledAnswerPreparationFunction | undefined {
    return compileGeneratedFunction<CompiledAnswerPreparationFunction>(this.expr, ['ctx'], functionRegistry, () =>
      this.buildSource(fieldBlocks, iterateNodes),
    )
  }

  generateSource(
    fieldBlocks: FieldBlockASTNode[],
    iterateNodes: IterateASTNode[] = [],
    functionRegistry?: FunctionRegistry,
  ): string {
    return buildGeneratedSource(this.expr, functionRegistry, () => this.buildSource(fieldBlocks, iterateNodes))
  }

  private buildSource(fieldBlocks: FieldBlockASTNode[], iterateNodes: IterateASTNode[]): string {
    const emitter = new CodeEmitter()

    emitter.emit('"use strict";')
    emitter.emit('var _isPost = ctx.request.method === "POST";')
    emitter.emitBlank()

    for (const block of fieldBlocks) {
      this.compileStaticField(block, emitter)
      emitter.emitBlank()
    }

    for (const iterateNode of iterateNodes) {
      this.compileIterateBlock(iterateNode, emitter)
      emitter.emitBlank()
    }

    return emitter.toString()
  }

  private compileStaticField(block: FieldBlockASTNode, emitter: CodeEmitter): void {
    const code = block.properties.code

    if (typeof code !== 'string') {
      return
    }

    const codeExpr = JSON.stringify(code)

    emitter.emitBlock('if (_isPost)', () => {
      this.compilePostPath(block, emitter, codeExpr)
    })
    emitter.emitBlock('else', () => {
      this.compileGetPath(block, emitter, codeExpr)
    })
  }

  private compilePostPath(block: FieldBlockASTNode, emitter: CodeEmitter, codeExpr: string): void {
    const histVar = emitter.nextVar('_hist')
    const lastSrcVar = emitter.nextVar('_lastSrc')

    // Action hooks can intentionally set an answer before POST processing. In
    // that case the posted body must not immediately overwrite it.
    emitter.emit(`var ${histVar} = ctx.answers[${codeExpr}];`)
    emitter.emit(
      `var ${lastSrcVar} = ${histVar} && ${histVar}.mutations && ${histVar}.mutations.length > 0 ? ${histVar}.mutations[${histVar}.mutations.length - 1].source : undefined;`,
    )

    emitter.emitBlock(`if (${lastSrcVar} !== "action")`, () => {
      this.emitEnsureHistory(emitter, codeExpr, histVar)

      const rawVar = emitter.nextVar('_raw')

      emitter.emit(`var ${rawVar} = ctx.post[${codeExpr}];`)
      this.compileMultipleBehavior(block, emitter, rawVar)

      this.emitPushMutation(emitter, histVar, rawVar, 'post')

      const formatters = block.properties.formatters

      if (Array.isArray(formatters) && formatters.length > 0) {
        const fmtVar = emitter.nextVar('_fv')

        emitter.emit(`var ${fmtVar} = ${rawVar};`)
        this.compileFormatterPipeline(formatters, emitter, fmtVar)

        emitter.emitBlock(`if (${fmtVar} !== ${rawVar})`, () => {
          this.emitPushMutation(emitter, histVar, fmtVar, 'processed')
        })
      }

      this.compileDependentWhen(block.properties.dependentWhen, emitter, codeExpr, histVar)
    })
  }

  private compileGetPath(block: FieldBlockASTNode, emitter: CodeEmitter, codeExpr: string): void {
    const histVar = emitter.nextVar('_ghist')

    emitter.emit(`var ${histVar} = ctx.answers[${codeExpr}];`)

    emitter.emitBlock(`if (!(${histVar} && ${histVar}.current !== undefined))`, () => {
      this.emitEnsureHistory(emitter, codeExpr, histVar)
      this.compileDefaultValue(block.properties.defaultValue, emitter, histVar)
    })
  }

  private compileMultipleBehavior(block: FieldBlockASTNode, emitter: CodeEmitter, rawVar: string): void {
    if (block.properties.multiple) {
      emitter.emitBlock(`if (!Array.isArray(${rawVar}))`, () => {
        emitter.emit(`${rawVar} = ${rawVar} !== undefined && ${rawVar} !== null ? [${rawVar}] : [];`)
      })
    } else {
      emitter.emitBlock(`if (Array.isArray(${rawVar}))`, () => {
        const foundVar = emitter.nextVar('_first')
        const iVar = emitter.nextVar('_fi')

        emitter.emit(`var ${foundVar} = undefined;`)
        emitter.emitBlock(`for (var ${iVar} = 0; ${iVar} < ${rawVar}.length; ${iVar}++)`, () => {
          const valVar = emitter.nextVar('_fval')

          emitter.emit(`var ${valVar} = ${rawVar}[${iVar}];`)
          emitter.emitBlock(
            `if (${valVar} !== undefined && ${valVar} !== null && (typeof ${valVar} !== "string" || ${valVar}.trim() !== ""))`,
            () => {
              emitter.emit(`${foundVar} = ${valVar}; break;`)
            },
          )
        })
        emitter.emit(`${rawVar} = ${foundVar};`)
      })
    }
  }

  private compileFormatterPipeline(formatters: unknown[], emitter: CodeEmitter, valueVar: string): void {
    for (const formatter of formatters) {
      if (!isASTNode(formatter) && !this.expr.isTemplateNode(formatter)) {
        continue
      }

      const resultVar = emitter.nextVar('_fr')
      const callExpr = this.compileFormatterCall(formatter, valueVar)

      emitter.emit(`var ${resultVar};`)
      emitter.emitBlock('try', () => {
        emitter.emit(`${resultVar} = ${callExpr};`)
      })
      emitter.emitBlock('catch(e)', () => {
        emitter.emit(`${resultVar} = undefined;`)
      })
      emitter.emitBlock(`if (${resultVar} !== undefined)`, () => {
        emitter.emit(`${valueVar} = ${resultVar};`)
      })
    }
  }

  private compileDependentWhen(dependentWhen: unknown, emitter: CodeEmitter, codeExpr: string, histVar: string): void {
    if (!dependentWhen) {
      return
    }

    if (!isASTNode(dependentWhen) && !this.expr.isTemplateNode(dependentWhen)) {
      return
    }

    const dwVar = emitter.nextVar('_dw')

    emitter.emit(`var ${dwVar};`)
    emitter.emitBlock('try', () => {
      emitter.emit(`${dwVar} = ${this.expr.compileOperand(dependentWhen)};`)
    })
    emitter.emitBlock('catch(e)', () => {
      emitter.emit(`${dwVar} = true;`)
    })
    emitter.emitBlock(`if (!${dwVar})`, () => {
      this.emitPushMutation(emitter, histVar, 'undefined', 'dependentWhen')
    })
  }

  private compileDefaultValue(defaultValue: unknown, emitter: CodeEmitter, histVar: string): void {
    if (defaultValue !== undefined && (isASTNode(defaultValue) || this.expr.isTemplateNode(defaultValue))) {
      const defVar = emitter.nextVar('_def')

      emitter.emit(`var ${defVar};`)
      emitter.emitBlock('try', () => {
        emitter.emit(`${defVar} = ${this.expr.compileOperand(defaultValue)};`)
      })
      emitter.emitBlock('catch(e)', () => {
        emitter.emit(`${defVar} = undefined;`)
      })
      this.emitPushMutation(emitter, histVar, defVar, 'default')

      return
    }

    if (defaultValue !== undefined) {
      this.emitPushMutation(emitter, histVar, JSON.stringify(defaultValue), 'default')

      return
    }

    this.emitPushMutation(emitter, histVar, 'undefined', 'default')
  }

  /**
   * MAP-yielded fields are prepared inside the same loop that render and
   * validation use, so dynamic field codes and @item/@scope references resolve
   * without request-time node registration.
   */
  private compileIterateBlock(iterateNode: IterateASTNode, emitter: CodeEmitter): void {
    if (iterateNode.properties.iterator.type !== IteratorType.MAP) {
      return
    }

    const template = iterateNode.properties.iterator.yieldTemplate

    if (template === undefined) {
      return
    }

    const templateFields = this.findTemplateFields(template)

    if (templateFields.length === 0) {
      return
    }

    const inputExpr = this.expr.compileOperand(iterateNode.properties.input)
    const inputVar = emitter.nextVar('_input')
    const indexVar = emitter.nextVar('_idx')
    const itemVar = emitter.nextVar('_item')

    emitter.emit(`var ${inputVar} = ${inputExpr};`)
    emitNormalizeIteratorInput(emitter, inputVar)

    emitter.emitBlock(`if (Array.isArray(${inputVar}))`, () => {
      emitter.emitBlock(`for (var ${indexVar} = 0; ${indexVar} < ${inputVar}.length; ${indexVar}++)`, () => {
        emitter.emitBlock(`if (${inputVar}[${indexVar}] == null)`, () => {
          emitter.emit('continue;')
        })
        emitIteratorItemScope(emitter, inputVar, indexVar, itemVar)

        for (const templateField of templateFields) {
          const codeVar = this.compileTemplateFieldCode(templateField, indexVar, itemVar, emitter)
          const frame: IteratorScopeFrame = { itemVar, indexVar, codeVar }

          this.expr.pushIteratorFrame(frame)
          this.compileTemplateField(templateField, codeVar, emitter)
          this.expr.popIteratorFrame()
        }
      })
    })
  }

  private compileTemplateFieldCode(
    field: TemplateNode,
    indexVar: string,
    itemVar: string,
    emitter: CodeEmitter,
  ): string | undefined {
    const code = field.properties?.code

    if (typeof code === 'string') {
      return undefined
    }

    if (this.expr.isTemplateNode(code)) {
      const codeVar = emitter.nextVar('_code')
      const frame: IteratorScopeFrame = { itemVar, indexVar }

      this.expr.pushIteratorFrame(frame)
      const codeExpr = this.expr.compileTemplateExpression(code)

      this.expr.popIteratorFrame()
      emitter.emit(`var ${codeVar} = String(${codeExpr});`)

      return codeVar
    }

    return undefined
  }

  private compileTemplateField(field: TemplateNode, codeVar: string | undefined, emitter: CodeEmitter): void {
    const staticCode = typeof field.properties?.code === 'string' ? (field.properties.code as string) : undefined
    const codeExpr = codeVar ?? JSON.stringify(staticCode)

    emitter.emitBlock('if (_isPost)', () => {
      this.compileTemplatePostPath(field, emitter, codeExpr)
    })
    emitter.emitBlock('else', () => {
      this.compileTemplateGetPath(field, emitter, codeExpr)
    })
  }

  private compileTemplatePostPath(field: TemplateNode, emitter: CodeEmitter, codeExpr: string): void {
    const histVar = emitter.nextVar('_thist')

    emitter.emit(`var ${histVar} = ctx.answers[${codeExpr}];`)
    const lastSrcVar = emitter.nextVar('_tlastSrc')

    emitter.emit(
      `var ${lastSrcVar} = ${histVar} && ${histVar}.mutations && ${histVar}.mutations.length > 0 ? ${histVar}.mutations[${histVar}.mutations.length - 1].source : undefined;`,
    )

    emitter.emitBlock(`if (${lastSrcVar} !== "action")`, () => {
      this.emitEnsureHistory(emitter, codeExpr, histVar)

      const rawVar = emitter.nextVar('_traw')

      emitter.emit(`var ${rawVar} = ctx.post[${codeExpr}];`)

      const isMultiple = field.properties?.multiple === true

      if (isMultiple) {
        emitter.emitBlock(`if (!Array.isArray(${rawVar}))`, () => {
          emitter.emit(`${rawVar} = ${rawVar} !== undefined && ${rawVar} !== null ? [${rawVar}] : [];`)
        })
      } else {
        emitter.emitBlock(`if (Array.isArray(${rawVar}))`, () => {
          const foundVar = emitter.nextVar('_tfirst')
          const tfiVar = emitter.nextVar('_tfi')

          emitter.emit(`var ${foundVar} = undefined;`)
          emitter.emitBlock(`for (var ${tfiVar} = 0; ${tfiVar} < ${rawVar}.length; ${tfiVar}++)`, () => {
            const valVar = emitter.nextVar('_tfval')

            emitter.emit(`var ${valVar} = ${rawVar}[${tfiVar}];`)
            emitter.emitBlock(
              `if (${valVar} !== undefined && ${valVar} !== null && (typeof ${valVar} !== "string" || ${valVar}.trim() !== ""))`,
              () => {
                emitter.emit(`${foundVar} = ${valVar}; break;`)
              },
            )
          })
          emitter.emit(`${rawVar} = ${foundVar};`)
        })
      }

      this.emitPushMutation(emitter, histVar, rawVar, 'post')

      const formatters = field.properties?.formatters

      if (Array.isArray(formatters) && formatters.length > 0) {
        const fmtVar = emitter.nextVar('_tfv')

        emitter.emit(`var ${fmtVar} = ${rawVar};`)
        this.compileFormatterPipeline(formatters, emitter, fmtVar)

        emitter.emitBlock(`if (${fmtVar} !== ${rawVar})`, () => {
          this.emitPushMutation(emitter, histVar, fmtVar, 'processed')
        })
      }

      this.compileDependentWhen(field.properties?.dependentWhen, emitter, codeExpr, histVar)
    })
  }

  private compileTemplateGetPath(field: TemplateNode, emitter: CodeEmitter, codeExpr: string): void {
    const histVar = emitter.nextVar('_tghist')

    emitter.emit(`var ${histVar} = ctx.answers[${codeExpr}];`)

    emitter.emitBlock(`if (!(${histVar} && ${histVar}.current !== undefined))`, () => {
      this.emitEnsureHistory(emitter, codeExpr, histVar)
      this.compileDefaultValue(field.properties?.defaultValue, emitter, histVar)
    })
  }

  /**
   * Formatters are pipeline-shaped calls whose first argument is the current
   * answer value. Emitting them through the shared function call path keeps async
   * formatter chains sequential and preserves the author-facing contract.
   */
  private compileFormatterCall(formatterNode: unknown, valueVar: string): string {
    const expressionType = (formatterNode as Record<string, unknown>).expressionType as string | undefined

    if (expressionType === FunctionType.TRANSFORMER || expressionType === FunctionType.CONDITION) {
      const properties = (formatterNode as Record<string, unknown>).properties as Record<string, unknown>
      const funcName = properties.name as string
      const funcArgs = (properties.arguments ?? []) as unknown[]
      const argExprs = funcArgs.map(arg => this.expr.compileOperand(arg))

      return this.expr.compileFunctionCall(funcName, [valueVar, ...argExprs])
    }

    if (expressionType === ExpressionType.PIPELINE) {
      return this.compilePipelineAsFormatter(formatterNode, valueVar)
    }

    return this.expr.compileFunctionCall('unknown', [valueVar])
  }

  private compilePipelineAsFormatter(node: unknown, valueVar: string): string {
    const properties = (node as Record<string, unknown>).properties as Record<string, unknown>
    const steps = (properties?.steps ?? []) as unknown[]
    let expr = valueVar

    for (const step of steps) {
      const stepProps = ((step as Record<string, unknown>).properties ?? step) as Record<string, unknown>
      const funcName = stepProps.name as string
      const funcArgs = (stepProps.arguments ?? []) as unknown[]
      const argExprs = funcArgs.map(arg => this.expr.compileOperand(arg))

      expr = this.expr.compileFunctionCall(funcName, [expr, ...argExprs])
    }

    return expr
  }

  private emitEnsureHistory(emitter: CodeEmitter, codeExpr: string, histVar: string): void {
    emitter.emitBlock(`if (!${histVar})`, () => {
      emitter.emit(`${histVar} = { current: undefined, mutations: [] }; ctx.answers[${codeExpr}] = ${histVar};`)
    })
  }

  private emitPushMutation(emitter: CodeEmitter, histVar: string, valueExpr: string, source: string): void {
    emitter.emit(`${histVar}.mutations.push({ value: ${valueExpr}, source: ${JSON.stringify(source)} });`)
    emitter.emit(`${histVar}.current = ${valueExpr};`)
  }

  /**
   * Template fields can be nested below conditional reveals or child blocks, so
   * answer prep walks the whole yield template before emitting the iterator loop.
   */
  private findTemplateFields(template: TemplateValue): TemplateNode[] {
    const results: TemplateNode[] = []

    this.walkTemplate(template, results)

    return results
  }

  private walkTemplate(value: TemplateValue, results: TemplateNode[]): void {
    if (value === null || value === undefined || typeof value !== 'object') {
      return
    }

    if (this.expr.isTemplateNode(value)) {
      if (value.originalType === ASTNodeType.BLOCK && value.blockType === BlockType.FIELD) {
        results.push(value)
      }

      if (value.properties) {
        Object.values(value.properties).forEach(child => {
          this.walkTemplate(child as TemplateValue, results)
        })
      }

      return
    }

    if (Array.isArray(value)) {
      value.forEach(item => {
        this.walkTemplate(item, results)
      })

      return
    }

    Object.values(value).forEach(item => {
      this.walkTemplate(item, results)
    })
  }
}
