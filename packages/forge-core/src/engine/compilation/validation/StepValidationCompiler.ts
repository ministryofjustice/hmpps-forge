/**
 * Compiles a step's field and domain validation into one generated function.
 *
 * Validation rules are ordinary compiled AST values. The `validWhen` slot
 * evaluates those values, recursively flattens arrays produced by iterators,
 * and turns failing validation results into field or domain failures.
 *
 * Static fields are already present in the shared AST, while fields inside MAP
 * iterators remain as template nodes. Iterator field validation emits loops over
 * the iterator input and evaluates the yield template in-place, so no runtime AST
 * nodes or overlays are created.
 *
 * Function calls stay indirect through FunctionRegistry because journey authors
 * provide those implementations. Registry metadata decides whether generated
 * source remains sync or becomes async; controllers await both shapes.
 *
 * If source generation fails, compile() returns undefined and controllers fail
 * fast. There is no secondary validation execution path.
 */
import { FieldBlockASTNode, StepASTNode } from '../../types/structures.type'
import { IterateASTNode } from '../../types/expressions.type'
import { TemplateNode, TemplateValue } from '../../types/template.type'
import { StepValidityResult } from '../../runtime/types/StepValidityResult.type'
import FunctionRegistry from '../../registries/FunctionRegistry'
import CodeEmitter from '../codegen/CodeEmitter'
import NodeCompilationDispatcher from '../codegen/NodeCompilationDispatcher'
import { buildGeneratedSource, compileGeneratedFunction } from '../codegen/GeneratedFunctionCompiler'
import ScopedTemplateCompiler, { isTemplateFieldNode } from '../codegen/ScopedTemplateCompiler'
import RuntimeValueCompiler from '../codegen/RuntimeValueCompiler'

export interface ValidationContext {
  answers: Record<string, { current: unknown }>
  data: Record<string, unknown>
  session: Record<string, unknown>
  params: Record<string, unknown>
  query: Record<string, unknown>
  request: Record<string, unknown>
  conditions: FunctionRegistry
}

type SyncCompiledValidationFunction = (
  ctx: ValidationContext,
  isSubmission: boolean,
  groups?: string[],
) => StepValidityResult

export type CompiledValidationFunction = (
  ctx: ValidationContext,
  isSubmission: boolean,
  groups?: string[],
) => StepValidityResult | Promise<StepValidityResult>

export default class StepValidationCompiler {
  private readonly expr = new NodeCompilationDispatcher()

  private readonly values = new RuntimeValueCompiler(this.expr, {
    expressionErrorFallback: 'undefined',
    omitUndefinedArrayItems: false,
  })

  private readonly templates = new ScopedTemplateCompiler(this.expr)

  compile(
    stepNode: StepASTNode,
    fieldBlocks: FieldBlockASTNode[],
    domainValidWhen: unknown,
    iterateNodes?: IterateASTNode[],
  ): SyncCompiledValidationFunction | undefined

  compile(
    stepNode: StepASTNode,
    fieldBlocks: FieldBlockASTNode[],
    domainValidWhen: unknown,
    iterateNodes: IterateASTNode[],
    functionRegistry: FunctionRegistry,
  ): CompiledValidationFunction | undefined

  compile(
    stepNode: StepASTNode,
    fieldBlocks: FieldBlockASTNode[],
    domainValidWhen: unknown,
    iterateNodes: IterateASTNode[] = [],
    functionRegistry?: FunctionRegistry,
  ): CompiledValidationFunction | SyncCompiledValidationFunction | undefined {
    return compileGeneratedFunction<CompiledValidationFunction>(
      this.expr,
      ['ctx', 'isSubmission', 'groups'],
      functionRegistry,
      () => this.buildSource(fieldBlocks, domainValidWhen, iterateNodes),
    )
  }

  generateSource(
    stepNode: StepASTNode,
    fieldBlocks: FieldBlockASTNode[],
    domainValidWhen: unknown,
    iterateNodes: IterateASTNode[] = [],
    functionRegistry?: FunctionRegistry,
  ): string {
    return buildGeneratedSource(this.expr, functionRegistry, () =>
      this.buildSource(fieldBlocks, domainValidWhen, iterateNodes),
    )
  }

  private buildSource(
    fieldBlocks: FieldBlockASTNode[],
    domainValidWhen: unknown,
    iterateNodes: IterateASTNode[],
  ): string {
    const emitter = new CodeEmitter()

    emitter.emit('"use strict";')
    emitter.emit('var _activeGroups = Array.isArray(groups) && groups.length > 0 ? groups : ["default"];')
    emitter.emit('var _activeGroupSet = Object.create(null);')
    emitter.emitBlock('for (var _groupIndex = 0; _groupIndex < _activeGroups.length; _groupIndex++)', () => {
      emitter.emit('_activeGroupSet[String(_activeGroups[_groupIndex])] = true;')
    })
    this.emitValidationRuntimeHelpers(emitter)
    emitter.emit('var errors = [];')
    emitter.emit('var domainErrors = [];')
    emitter.emitBlank()

    for (const block of fieldBlocks) {
      this.compileFieldBlock(block, emitter)
      emitter.emitBlank()
    }

    for (const iterateNode of iterateNodes) {
      this.compileIterateBlock(iterateNode, emitter)
      emitter.emitBlank()
    }

    this.compileDomainValidationSlot(domainValidWhen, emitter)
    emitter.emitBlank()

    emitter.emit(
      'return { isValid: errors.length === 0 && domainErrors.length === 0, fieldFailures: errors, domainFailures: domainErrors };',
    )

    return emitter.toString()
  }

  private emitValidationRuntimeHelpers(emitter: CodeEmitter): void {
    emitter.emitBlock('function _validationGroupsActive(value)', () => {
      emitter.emit('var validationGroups = Array.isArray(value) && value.length > 0 ? value : ["default"];')
      emitter.emitBlock('for (var i = 0; i < validationGroups.length; i++)', () => {
        emitter.emitBlock('if (_activeGroupSet[String(validationGroups[i])] === true)', () => {
          emitter.emit('return true;')
        })
      })
      emitter.emit('return false;')
    })
  }

  private compileIterateBlock(iterateNode: IterateASTNode, emitter: CodeEmitter): void {
    const template = iterateNode.properties.iterator.yieldTemplate

    if (template === undefined) {
      return
    }

    const templateFields = this.findTemplateFieldsWithValidation(template)

    if (templateFields.length === 0) {
      return
    }

    this.templates.compileMapIterator(iterateNode, emitter, () => {
      templateFields.forEach(templateField => {
        const codeExpr = this.templates.compileTemplateCodeExpression(templateField, emitter)

        this.compileTemplateFieldValidations(templateField, codeExpr, emitter)
      })
    })
  }

  private compileTemplateFieldValidations(
    field: TemplateNode,
    codeExpr: string | undefined,
    emitter: CodeEmitter,
  ): void {
    const validWhen = field.properties?.validWhen

    if (!hasConfiguredValue(validWhen)) {
      return
    }

    const blockCodeExpr = codeExpr ?? 'undefined'

    this.expr.withSelfCodeExpression(codeExpr, () => {
      const dependentWhen = field.properties?.dependentWhen

      if (dependentWhen !== undefined) {
        const guardExpr = this.expr.compileOperand(dependentWhen)

        emitter.emitBlock(`if (${guardExpr})`, () => {
          this.compileFieldValidationSlot(validWhen, JSON.stringify('iterator'), blockCodeExpr, emitter)
        })

        return
      }

      this.compileFieldValidationSlot(validWhen, JSON.stringify('iterator'), blockCodeExpr, emitter)
    })
  }

  /**
   * Static fields are guarded by dependentWhen before any validWhen checks run,
   * matching the request-time rule that hidden dependent fields should not fail.
   */
  private compileFieldBlock(block: FieldBlockASTNode, emitter: CodeEmitter): void {
    const validWhen = block.properties.validWhen

    if (!hasConfiguredValue(validWhen)) {
      return
    }

    const selfCodeExpr = this.compileFieldCodeExpression(block.properties.code)
    const blockCodeExpr = selfCodeExpr ?? 'undefined'
    const hasDependentWhen =
      block.properties.dependentWhen !== undefined && this.expr.isCompilableNode(block.properties.dependentWhen)

    this.expr.withSelfCodeExpression(selfCodeExpr, () => {
      if (hasDependentWhen) {
        const guardExpr = this.expr.compileExpression(block.properties.dependentWhen!)

        emitter.emitBlock(`if (${guardExpr})`, () => {
          this.compileFieldValidationSlot(validWhen, JSON.stringify(block.id), blockCodeExpr, emitter)
        })

        return
      }

      this.compileFieldValidationSlot(validWhen, JSON.stringify(block.id), blockCodeExpr, emitter)
    })
  }

  private compileFieldCodeExpression(code: unknown): string | undefined {
    if (typeof code === 'string') {
      return JSON.stringify(code)
    }

    if (this.expr.isCompilableNode(code) || this.expr.isTemplateNode(code)) {
      return this.expr.compileOperand(code)
    }

    return undefined
  }

  private compileFieldValidationSlot(
    value: unknown,
    blockIdExpr: string,
    fallbackBlockCodeExpr: string,
    emitter: CodeEmitter,
  ): void {
    const resultsVar = emitter.nextVar('_vresults')

    emitter.emit(`var ${resultsVar};`)
    this.values.compileValue(value, emitter, resultsVar)
    this.emitValidationResultLoop(resultsVar, '_v', emitter, (resultVar, messageVar, detailsVar) => {
      const blockCodeVar = emitter.nextVar('_vblockCode')
      const awaitKeyword = this.expr.usesAwait ? 'await ' : ''

      emitter.emit(
        `var ${blockCodeVar} = typeof ${resultVar}.resolvedBlockCode === "function" ? ${resultVar}.resolvedBlockCode() : ${resultVar}.resolvedBlockCode;`,
      )

      if (awaitKeyword) {
        emitter.emit(`${blockCodeVar} = await ${blockCodeVar};`)
      }

      emitter.emitBlock(`if (${blockCodeVar} === undefined)`, () => {
        emitter.emit(`${blockCodeVar} = ${fallbackBlockCodeExpr};`)
      })
      emitter.emit(
        `errors.push({ blockId: ${blockIdExpr}, blockCode: ${blockCodeVar}, passed: false, message: ${messageVar}, submissionOnly: ${resultVar}.submissionOnly === true, details: ${detailsVar} });`,
      )
    })
  }

  private compileDomainValidationSlot(value: unknown, emitter: CodeEmitter): void {
    if (!hasConfiguredValue(value)) {
      return
    }

    const resultsVar = emitter.nextVar('_dresults')

    emitter.emit(`var ${resultsVar};`)
    this.values.compileValue(value, emitter, resultsVar)
    this.emitValidationResultLoop(resultsVar, '_d', emitter, (resultVar, messageVar, detailsVar) => {
      emitter.emit(
        `domainErrors.push({ passed: false, message: ${messageVar}, submissionOnly: ${resultVar}.submissionOnly === true, details: ${detailsVar} });`,
      )
    })
  }

  private emitValidationResultLoop(
    resultsVar: string,
    varPrefix: string,
    emitter: CodeEmitter,
    emitFailure: (resultVar: string, messageVar: string, detailsVar: string) => void,
  ): void {
    const awaitKeyword = this.expr.usesAwait ? 'await ' : ''
    const stackVar = emitter.nextVar(`${varPrefix}stack`)
    const resultVar = emitter.nextVar(`${varPrefix}result`)
    const indexVar = emitter.nextVar(`${varPrefix}index`)
    const passedVar = emitter.nextVar(`${varPrefix}passed`)
    const messageVar = emitter.nextVar(`${varPrefix}message`)
    const detailsVar = emitter.nextVar(`${varPrefix}details`)

    emitter.emit(`var ${stackVar} = [${resultsVar}];`)
    emitter.emitBlock(`while (${stackVar}.length > 0)`, () => {
      emitter.emit(`var ${resultVar} = ${stackVar}.pop();`)
      emitter.emitBlock(`if (${resultVar} == null)`, () => {
        emitter.emit('continue;')
      })
      emitter.emitBlock(`if (Array.isArray(${resultVar}))`, () => {
        emitter.emitBlock(`for (var ${indexVar} = ${resultVar}.length - 1; ${indexVar} >= 0; ${indexVar}--)`, () => {
          emitter.emit(`${stackVar}.push(${resultVar}[${indexVar}]);`)
        })
        emitter.emit('continue;')
      })
      emitter.emit(`if (${resultVar}.submissionOnly === true && !isSubmission) { continue; }`)
      emitter.emit(`if (!_validationGroupsActive(${resultVar}.groups)) { continue; }`)
      emitter.emit(
        `var ${passedVar} = typeof ${resultVar}.evaluate === "function" ? ${resultVar}.evaluate() : ${resultVar}.passed;`,
      )

      if (awaitKeyword) {
        emitter.emit(`${passedVar} = await ${passedVar};`)
      }

      emitter.emit(`if (${passedVar}) { continue; }`)
      emitter.emit(
        `var ${messageVar} = typeof ${resultVar}.message === "function" ? ${resultVar}.message() : ${resultVar}.message;`,
      )
      emitter.emit(
        `var ${detailsVar} = typeof ${resultVar}.details === "function" ? ${resultVar}.details() : ${resultVar}.details;`,
      )

      if (awaitKeyword) {
        emitter.emit(`${messageVar} = await ${messageVar};`)
        emitter.emit(`${detailsVar} = await ${detailsVar};`)
      }

      emitter.emitBlock(`if (${messageVar} === undefined)`, () => {
        emitter.emit(`${messageVar} = "";`)
      })
      emitFailure(resultVar, messageVar, detailsVar)
    })
  }

  private findTemplateFieldsWithValidation(template: TemplateValue): TemplateNode[] {
    return this.templates.findTemplateNodes(
      template,
      node => isTemplateFieldNode(node) && hasConfiguredValue(node.properties?.validWhen),
    )
  }
}

function hasConfiguredValue(value: unknown): boolean {
  if (value === undefined) {
    return false
  }

  if (Array.isArray(value)) {
    return value.length > 0
  }

  return true
}
