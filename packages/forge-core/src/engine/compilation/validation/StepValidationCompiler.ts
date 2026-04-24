/**
 * Compiles a step's field and domain validation into one generated function.
 *
 * Static fields are already present in the shared AST, while fields inside MAP
 * iterators remain as template nodes. Static field validation compiles directly
 * from registered FieldBlockASTNodes. Iterator field validation emits loops over
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
import { ASTNode } from '../../types/ast.type'
import { ASTNodeType } from '../../types/enums'
import { BlockType, IteratorType } from '../../../authoring/types/enums'
import { FieldBlockASTNode, StepASTNode } from '../../types/structures.type'
import { IterateASTNode, ValidationASTNode } from '../../types/expressions.type'
import { TemplateNode, TemplateValue } from '../../types/template.type'
import { StepValidityResult } from '../../runtime/types/StepValidityResult.type'
import FunctionRegistry from '../../registries/FunctionRegistry'
import CodeEmitter from '../codegen/CodeEmitter'
import NodeCompilationDispatcher, { IteratorScopeFrame } from '../codegen/NodeCompilationDispatcher'
import { buildGeneratedSource, compileGeneratedFunction } from '../codegen/GeneratedFunctionCompiler'
import { emitIteratorItemScope, emitNormalizeIteratorInput } from '../codegen/iteratorCodegen'

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

  compile(
    stepNode: StepASTNode,
    fieldBlocks: FieldBlockASTNode[],
    domainValidationNodes: ASTNode[],
    iterateNodes?: IterateASTNode[],
  ): SyncCompiledValidationFunction | undefined

  compile(
    stepNode: StepASTNode,
    fieldBlocks: FieldBlockASTNode[],
    domainValidationNodes: ASTNode[],
    iterateNodes: IterateASTNode[],
    functionRegistry: FunctionRegistry,
  ): CompiledValidationFunction | undefined

  compile(
    stepNode: StepASTNode,
    fieldBlocks: FieldBlockASTNode[],
    domainValidationNodes: ASTNode[],
    iterateNodes: IterateASTNode[] = [],
    functionRegistry?: FunctionRegistry,
  ): CompiledValidationFunction | SyncCompiledValidationFunction | undefined {
    return compileGeneratedFunction<CompiledValidationFunction>(
      this.expr,
      ['ctx', 'isSubmission', 'groups'],
      functionRegistry,
      () => this.buildSource(fieldBlocks, domainValidationNodes, iterateNodes),
    )
  }

  generateSource(
    stepNode: StepASTNode,
    fieldBlocks: FieldBlockASTNode[],
    domainValidationNodes: ASTNode[],
    iterateNodes: IterateASTNode[] = [],
    functionRegistry?: FunctionRegistry,
  ): string {
    return buildGeneratedSource(this.expr, functionRegistry, () =>
      this.buildSource(fieldBlocks, domainValidationNodes, iterateNodes),
    )
  }

  private buildSource(
    fieldBlocks: FieldBlockASTNode[],
    domainValidationNodes: ASTNode[],
    iterateNodes: IterateASTNode[],
  ): string {
    const emitter = new CodeEmitter()

    emitter.emit('"use strict";')
    emitter.emit('var _activeGroups = Array.isArray(groups) && groups.length > 0 ? groups : ["default"];')
    emitter.emit('var _activeGroupSet = Object.create(null);')
    emitter.emitBlock('for (var _groupIndex = 0; _groupIndex < _activeGroups.length; _groupIndex++)', () => {
      emitter.emit('_activeGroupSet[String(_activeGroups[_groupIndex])] = true;')
    })
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

    for (const node of domainValidationNodes) {
      this.compileDomainValidation(node as ValidationASTNode, emitter)
      emitter.emitBlank()
    }

    emitter.emit(
      'return { isValid: errors.length === 0 && domainErrors.length === 0, fieldFailures: errors, domainFailures: domainErrors };',
    )

    return emitter.toString()
  }

  private compileIterateBlock(iterateNode: IterateASTNode, emitter: CodeEmitter): void {
    if (iterateNode.properties.iterator.type !== IteratorType.MAP) {
      return
    }

    const template = iterateNode.properties.iterator.yieldTemplate

    if (template === undefined) {
      return
    }

    const templateFields = this.findTemplateFieldsWithValidation(template)

    if (templateFields.length === 0) {
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
        emitter.emitBlock(`if (${rawItemExpr} == null)`, () => {
          emitter.emit('continue;')
        })
        emitIteratorItemScope(emitter, inputVar, indexVar, itemVar)

        for (const templateField of templateFields) {
          const codeVar = this.compileTemplateFieldCode(templateField, indexVar, itemVar, rawItemExpr, emitter)
          const frame: IteratorScopeFrame = { itemVar, indexVar, rawItemExpr, codeVar }

          this.expr.pushIteratorFrame(frame)
          this.compileTemplateFieldValidations(templateField, codeVar, emitter)
          this.expr.popIteratorFrame()
        }
      })
    })
  }

  private compileTemplateFieldCode(
    field: TemplateNode,
    indexVar: string,
    itemVar: string,
    rawItemExpr: string,
    emitter: CodeEmitter,
  ): string | undefined {
    const code = field.properties?.code

    if (typeof code === 'string') {
      return undefined
    }

    if (this.expr.isTemplateNode(code)) {
      const codeVar = emitter.nextVar('_code')
      const frame: IteratorScopeFrame = { itemVar, indexVar, rawItemExpr }

      this.expr.pushIteratorFrame(frame)
      const codeExpr = this.expr.compileTemplateExpression(code)

      this.expr.popIteratorFrame()
      emitter.emit(`var ${codeVar} = String(${codeExpr});`)

      return codeVar
    }

    return undefined
  }

  private compileTemplateFieldValidations(
    field: TemplateNode,
    codeVar: string | undefined,
    emitter: CodeEmitter,
  ): void {
    const validWhen = field.properties?.validWhen

    if (!Array.isArray(validWhen)) {
      return
    }

    const staticCode = typeof field.properties?.code === 'string' ? (field.properties.code as string) : undefined
    const blockCodeExpr = codeVar ?? (staticCode ? JSON.stringify(staticCode) : 'undefined')

    const dependentWhen = field.properties?.dependentWhen

    if (this.expr.isTemplateNode(dependentWhen)) {
      const guardExpr = this.expr.compileTemplateExpression(dependentWhen)

      emitter.emitBlock(`if (${guardExpr})`, () => {
        for (const validation of validWhen) {
          if (this.expr.isTemplateNode(validation)) {
            this.compileTemplateValidationNode(validation, blockCodeExpr, emitter)
          }
        }
      })
    } else {
      for (const validation of validWhen) {
        if (this.expr.isTemplateNode(validation)) {
          this.compileTemplateValidationNode(validation, blockCodeExpr, emitter)
        }
      }
    }
  }

  private compileTemplateValidationNode(node: TemplateNode, blockCodeExpr: string, emitter: CodeEmitter): void {
    const submissionOnly = node.properties?.submissionOnly === true
    const groupGuard = this.compileGroupsGuard(readTemplateGroups(node))

    emitter.emitBlock(`if (${groupGuard})`, () => {
      if (submissionOnly) {
        emitter.emitBlock('if (isSubmission)', () => {
          this.emitTemplateValidationCheck(node, blockCodeExpr, emitter)
        })

        return
      }

      this.emitTemplateValidationCheck(node, blockCodeExpr, emitter)
    })
  }

  private compileGroupsGuard(groups: string[] | undefined): string {
    return normalizeGroups(groups)
      .map(group => `_activeGroupSet[${JSON.stringify(group)}] === true`)
      .join(' || ')
  }

  private compileValidationNode(
    node: ValidationASTNode,
    block: FieldBlockASTNode,
    blockCode: string | undefined,
    emitter: CodeEmitter,
  ): void {
    const groupGuard = this.compileGroupsGuard(node.properties.groups)

    emitter.emitBlock(`if (${groupGuard})`, () => {
      if (node.properties.submissionOnly === true) {
        emitter.emitBlock('if (isSubmission)', () => {
          this.emitValidationCheck(node, block, blockCode, emitter)
        })

        return
      }

      this.emitValidationCheck(node, block, blockCode, emitter)
    })
  }

  private emitValidationCheck(
    node: ValidationASTNode,
    block: FieldBlockASTNode,
    blockCode: string | undefined,
    emitter: CodeEmitter,
  ): void {
    const condVar = emitter.nextVar('_cond')
    const condExpr = this.expr.compileExpression(node.properties.condition)

    emitter.emit(`var ${condVar};`)
    emitter.emitBlock('try', () => {
      emitter.emit(`${condVar} = ${condExpr};`)
    })
    emitter.emitBlock('catch(e)', () => {
      emitter.emit(`${condVar} = false;`)
    })

    const messageExpr = this.compileMessage(node.properties.message)
    const resolvedBlockCode = this.compileResolvedBlockCode(node, blockCode)
    const detailsExpr = this.compileDetails(node.properties.details)

    emitter.emitBlock(`if (!${condVar})`, () => {
      emitter.emit(
        `errors.push({ blockId: ${JSON.stringify(block.id)}, blockCode: ${resolvedBlockCode}, passed: false, message: ${messageExpr}, submissionOnly: ${isSubmissionOnlyStr(node)}, details: ${detailsExpr} });`,
      )
    })
  }

  private compileDomainValidation(node: ValidationASTNode, emitter: CodeEmitter): void {
    const groupGuard = this.compileGroupsGuard(node.properties.groups)

    emitter.emitBlock(`if (${groupGuard})`, () => {
      if (node.properties.submissionOnly === true) {
        emitter.emitBlock('if (isSubmission)', () => {
          this.emitDomainValidationCheck(node, emitter)
        })

        return
      }

      this.emitDomainValidationCheck(node, emitter)
    })
  }

  private emitTemplateValidationCheck(node: TemplateNode, blockCodeExpr: string, emitter: CodeEmitter): void {
    const condVar = emitter.nextVar('_cond')
    const condition = node.properties?.condition

    if (!condition) {
      return
    }

    const condExpr = this.expr.isTemplateNode(condition)
      ? this.expr.compileTemplateExpression(condition)
      : this.expr.compileOperand(condition)

    emitter.emit(`var ${condVar};`)
    emitter.emitBlock('try', () => {
      emitter.emit(`${condVar} = ${condExpr};`)
    })
    emitter.emitBlock('catch(e)', () => {
      emitter.emit(`${condVar} = false;`)
    })

    const message = node.properties?.message
    let messageExpr: string

    if (typeof message === 'string') {
      messageExpr = JSON.stringify(message)
    } else if (this.expr.isTemplateNode(message)) {
      messageExpr = this.expr.compileTemplateExpression(message)
    } else {
      messageExpr = JSON.stringify('')
    }
    const submissionOnly = node.properties?.submissionOnly === true ? 'true' : 'false'
    const details = node.properties?.details
    const detailsExpr = details !== undefined ? JSON.stringify(details) : 'undefined'

    emitter.emitBlock(`if (!${condVar})`, () => {
      emitter.emit(
        `errors.push({ blockId: "iterator", blockCode: ${blockCodeExpr}, passed: false, message: ${messageExpr}, submissionOnly: ${submissionOnly}, details: ${detailsExpr} });`,
      )
    })
  }

  /**
   * Static fields are guarded by dependentWhen before any validWhen checks run,
   * matching the request-time rule that hidden dependent fields should not fail.
   */
  private compileFieldBlock(block: FieldBlockASTNode, emitter: CodeEmitter): void {
    const validations = (block.properties.validWhen ?? []).filter(
      (v): v is ValidationASTNode => this.expr.isCompilableNode(v) && (v as ASTNode).type === ASTNodeType.EXPRESSION,
    )

    if (validations.length === 0) {
      return
    }

    const blockCode = typeof block.properties.code === 'string' ? block.properties.code : undefined
    const hasDependentWhen =
      block.properties.dependentWhen !== undefined && this.expr.isCompilableNode(block.properties.dependentWhen)

    if (hasDependentWhen) {
      const guardExpr = this.expr.compileExpression(block.properties.dependentWhen!)

      emitter.emitBlock(`if (${guardExpr})`, () => {
        for (const validation of validations) {
          this.compileValidationNode(validation, block, blockCode, emitter)
        }
      })
    } else {
      for (const validation of validations) {
        this.compileValidationNode(validation, block, blockCode, emitter)
      }
    }
  }

  private emitDomainValidationCheck(node: ValidationASTNode, emitter: CodeEmitter): void {
    const condVar = emitter.nextVar('_dcond')
    const condExpr = this.expr.compileExpression(node.properties.condition)

    emitter.emit(`var ${condVar};`)
    emitter.emitBlock('try', () => {
      emitter.emit(`${condVar} = ${condExpr};`)
    })
    emitter.emitBlock('catch(e)', () => {
      emitter.emit(`${condVar} = false;`)
    })

    const messageExpr = this.compileMessage(node.properties.message)
    const detailsExpr = this.compileDetails(node.properties.details)

    emitter.emitBlock(`if (!${condVar})`, () => {
      emitter.emit(
        `domainErrors.push({ passed: false, message: ${messageExpr}, submissionOnly: ${isSubmissionOnlyStr(node)}, details: ${detailsExpr} });`,
      )
    })
  }

  /**
   * Validation messages and resolved block codes can themselves be expressions,
   * so helpers route them back through the shared dispatcher instead of treating
   * them as render-only data.
   */
  private compileMessage(message: ASTNode | string): string {
    if (typeof message === 'string') {
      return JSON.stringify(message)
    }

    if (this.expr.isCompilableNode(message)) {
      return this.expr.compileExpression(message)
    }

    return JSON.stringify(String(message ?? ''))
  }

  private compileResolvedBlockCode(node: ValidationASTNode, blockCode: string | undefined): string {
    const resolved = node.properties.resolvedBlockCode

    if (typeof resolved === 'string') {
      return JSON.stringify(resolved)
    }

    if (resolved !== undefined && this.expr.isCompilableNode(resolved)) {
      return this.expr.compileExpression(resolved)
    }

    if (blockCode !== undefined) {
      return JSON.stringify(blockCode)
    }

    return 'undefined'
  }

  private compileDetails(details: Record<string, unknown> | undefined): string {
    if (details === undefined) {
      return 'undefined'
    }

    return JSON.stringify(details)
  }

  private findTemplateFieldsWithValidation(template: TemplateValue): TemplateNode[] {
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
        const validWhen = value.properties?.validWhen

        if (Array.isArray(validWhen) && validWhen.length > 0) {
          results.push(value)
        }
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

function isSubmissionOnlyStr(node: ValidationASTNode): string {
  return node.properties.submissionOnly === true ? 'true' : 'false'
}

function normalizeGroups(groups: string[] | undefined): string[] {
  return groups !== undefined && groups.length > 0 ? groups : ['default']
}

function readTemplateGroups(node: TemplateNode): string[] | undefined {
  const groups = node.properties?.groups

  if (!Array.isArray(groups)) {
    return undefined
  }

  return groups.filter(group => typeof group === 'string')
}
