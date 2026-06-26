/**
 * Compiles render context evaluation for one step.
 *
 * The generated function builds evaluated step metadata, journey ancestor
 * metadata, and blocks from the shared AST. Static values are emitted as JSON;
 * expression values are emitted through ExpressionDispatcher. Registry
 * metadata decides whether the generated source is sync or async.
 *
 * MAP iterators that yield blocks are emitted as loops that push blocks directly
 * into the render result. FILTER/FIND/MAP iterators used as property values are
 * compiled inline as expressions. No runtime node expansion is required.
 */
import { ASTNodeType } from '../../../../contracts/ast/enums'
import { BlockType, IteratorType } from '../../../../../authoring/types/enums'
import { BlockASTNode, JourneyASTNode, StepASTNode } from '../../../../contracts/ast/structures.type'
import { IterateASTNode } from '../../../../contracts/ast/expressions.type'
import { TemplateNode, TemplateValue } from '../../../../contracts/ast/template.type'
import CodeEmitter from '../../emitters/CodeEmitter'
import FieldCodeEmitter from '../../emitters/FieldCodeEmitter'
import ExpressionDispatcher from '../../expressions/ExpressionDispatcher'
import {
  buildGeneratedSource,
  compileGeneratedFunction,
  GENERATED_FUNCTION_HELPERS_PARAM,
} from '../../function-construction/GeneratedFunctionCompiler'
import ScopedTemplateCompiler, { isTemplateBlockNode } from '../../structures/ScopedTemplateCompiler'
import RuntimeValueCompiler from '../../structures/RuntimeValueCompiler'
import type { CompilationDependencies } from '../../compilationDependencies.type'

import type { CompiledResolveFunction } from '../../../../contracts/compiled/compiledFunctions.type'

interface ResolveBlockValue {
  readonly id?: unknown
  readonly type: ASTNodeType.BLOCK
  readonly variant: string
  readonly blockType: string
  readonly properties?: Record<string, unknown>
}

/**
 * Phase compiler for the generated step render function.
 *
 * It emits route metadata and renderable block structure while shared runtime
 * helpers handle generic behaviours such as field value resolution.
 */
export default class StepResolveCompiler {
  // These properties affect answer prep or validation, not rendered block props.
  private static readonly BLOCK_SKIP_PROPS = new Set(['formatters', 'parsers', 'validWhen', 'dependentWhen'])

  // Hooks, blocks, and reachability are executable structure, not render metadata.
  private static readonly STEP_SKIP_PROPS = new Set(['onAccess', 'onSubmission', 'blocks', 'reachability'])

  // Child structure and access hooks are route/lifecycle concerns, not metadata.
  private static readonly JOURNEY_SKIP_PROPS = new Set(['onAccess', 'children', 'steps', 'reachability'])

  // The resolve-blocks root task key, emitted into generated source and surfaced in the resolve trace.
  private static readonly ROOT_KEY = 'resolve-blocks'

  private readonly expr: ExpressionDispatcher

  private readonly fieldCodes: FieldCodeEmitter

  private readonly templates: ScopedTemplateCompiler

  private readonly values: RuntimeValueCompiler

  // Iterates used as property values are compiled at that property site. Track
  // them so block-yielding MAP iterators are not emitted a second time as
  // top-level blocks.
  private readonly inlineIterateIds = new Set<string>()

  constructor(dependencies: CompilationDependencies) {
    this.expr = new ExpressionDispatcher(dependencies)
    this.fieldCodes = new FieldCodeEmitter(this.expr)
    this.templates = new ScopedTemplateCompiler(this.expr)
    this.values = new RuntimeValueCompiler(this.expr, {
      expressionErrorFallback: 'undefined',
      expressionErrorMode: 'throw',
      omitUndefinedArrayItems: true,
      isStructuralValue: value => this.isResolveBlockValue(value),
      compileStructuralValue: (value, emitter, targetVar) =>
        this.tryCompileResolveBlockValue(value, emitter, targetVar),
      noteInlineIterator: nodeId => {
        this.inlineIterateIds.add(nodeId)
      },
    })
  }

  /**
   * Builds the executable render function for one step.
   *
   * The generated function may be sync or async depending on whether render
   * expressions call registered async functions.
   */
  compile(
    stepNode: StepASTNode,
    ancestorNodes: JourneyASTNode[],
    iterateNodes: IterateASTNode[] = [],
  ): CompiledResolveFunction | undefined {
    return compileGeneratedFunction<CompiledResolveFunction>(
      this.expr,
      ['ctx'],
      () => this.buildSource(stepNode, ancestorNodes, iterateNodes),
      { phase: 'resolve' },
    )
  }

  /**
   * Builds the raw render source for tests and debugging without constructing a Function.
   */
  generateSource(stepNode: StepASTNode, ancestorNodes: JourneyASTNode[], iterateNodes: IterateASTNode[] = []): string {
    return buildGeneratedSource(this.expr, () => this.buildSource(stepNode, ancestorNodes, iterateNodes))
  }

  /**
   * Emits the complete render function body in the same order the runtime result is assembled.
   */
  private buildSource(stepNode: StepASTNode, ancestorNodes: JourneyASTNode[], iterateNodes: IterateASTNode[]): string {
    this.inlineIterateIds.clear()
    const emitter = new CodeEmitter()

    emitter.code('"use strict";')

    emitter.comment('StepResolveCompiler.buildSource')
    emitter.declareConst('blocks', '[]')
    emitter.declareConst('step', '{}')
    emitter.declareConst('ancestors', '[]')

    this.compileStepMetadata(stepNode, emitter)

    this.compileAncestorMetadata(ancestorNodes, emitter)

    this.compileBlocks(stepNode.properties.blocks ?? [], emitter)

    this.compileIterateBlocks(iterateNodes, emitter)

    emitter.return(this.compileResolveBlocksWorkTaskExpression())

    return emitter.toString()
  }

  /**
   * Emits evaluated step metadata while excluding executable structure owned by other compilers.
   */
  private compileStepMetadata(stepNode: StepASTNode, emitter: CodeEmitter): void {
    emitter.comment('StepResolveCompiler.compileStepMetadata')

    for (const [key, value] of Object.entries(stepNode.properties)) {
      if (StepResolveCompiler.STEP_SKIP_PROPS.has(key)) {
        continue
      }

      this.compilePropertyAssignment(value, emitter, 'step', key)
    }
  }

  /**
   * Emits journey ancestor metadata and composes each ancestor path relative to its parents.
   */
  private compileAncestorMetadata(ancestorNodes: JourneyASTNode[], emitter: CodeEmitter): void {
    if (ancestorNodes.length === 0) {
      return
    }

    emitter.comment('StepResolveCompiler.compileAncestorMetadata')
    emitter.declareLet('composedPath', '""')

    for (let i = 0; i < ancestorNodes.length; i++) {
      const ancestor = ancestorNodes[i]

      emitter.scope(() => {
        const ancestorVar = emitter.const('ancestor', '{}')

        for (const [key, value] of Object.entries(ancestor.properties)) {
          if (StepResolveCompiler.JOURNEY_SKIP_PROPS.has(key)) {
            continue
          }

          this.compilePropertyAssignment(value, emitter, ancestorVar, key)
        }

        emitter.assign(
          'composedPath',
          `"/" + (composedPath + "/" + ${ancestorVar}["path"]).split("/").filter(Boolean).join("/")`,
        )
        emitter.assign(`${ancestorVar}["path"]`, 'composedPath')
        emitter.code(`ancestors.push(${ancestorVar});`)
      })
      emitter.emitBlank()
    }
  }

  /**
   * Emits the step's registered blocks in authoring order.
   */
  private compileBlocks(blocks: BlockASTNode[], emitter: CodeEmitter): void {
    if (blocks.length === 0) {
      return
    }

    emitter.comment('StepResolveCompiler.compileBlocks')

    for (const block of blocks) {
      this.compileBlock(block, emitter, 'blocks')
      emitter.emitBlank()
    }
  }

  /**
   * Emits one registered block, including evaluated properties and field value fallback.
   */
  private compileBlock(block: BlockASTNode, emitter: CodeEmitter, targetArrayVar: string): void {
    emitter.comment('StepResolveCompiler.compileBlock')
    emitter.scope(() => {
      const idVar = emitter.const('resolveBlockId', JSON.stringify(block.id))
      const propsVar = emitter.const('blockProps', '{}')

      this.compileBlockProperties(block.properties, block.blockType, emitter, propsVar, idVar)

      this.pushResolveBlockWorkTask(emitter, targetArrayVar, idVar, block.variant, block.blockType, propsVar)
    })
  }

  /**
   * Emits top-level blocks yielded by MAP iterators that were not already compiled inline.
   */
  private compileIterateBlocks(iterateNodes: IterateASTNode[], emitter: CodeEmitter): void {
    for (const iterateNode of iterateNodes) {
      if (this.inlineIterateIds.has(iterateNode.id)) {
        continue
      }

      if (iterateNode.properties.iterator.type !== IteratorType.MAP) {
        continue
      }

      const template = iterateNode.properties.iterator.yieldTemplate

      if (template === undefined) {
        continue
      }

      const templateBlocks = this.findTemplateBlocks(template)

      if (templateBlocks.length === 0) {
        continue
      }

      this.compileMapIteratorBlocks(iterateNode, templateBlocks, emitter)
      emitter.emitBlank()
    }
  }

  /**
   * Emits the iterator loop used when a MAP expression yields resolve blocks.
   */
  private compileMapIteratorBlocks(
    iterateNode: IterateASTNode,
    templateBlocks: TemplateNode[],
    emitter: CodeEmitter,
  ): void {
    emitter.comment('StepResolveCompiler.compileMapIteratorBlocks')
    this.templates.compileMapIterator(iterateNode, emitter, () => {
      templateBlocks.forEach(templateBlock => {
        const codeExpr = this.templates.compileTemplateCodeExpression(templateBlock, emitter)

        this.compileTemplateBlock(templateBlock, codeExpr, emitter)
      })
    })
  }

  /**
   * Emits a template block inside an iterator loop.
   */
  private compileTemplateBlock(block: TemplateNode, codeExpr: string | undefined, emitter: CodeEmitter): void {
    emitter.comment('StepResolveCompiler.compileTemplateBlock')
    const blockType = block.blockType

    emitter.scope(() => {
      const idVar = emitter.const('resolveBlockId', this.templates.compileTemplateInstanceIdExpression(block))
      const propsVar = emitter.const('templateBlockProps', '{}')
      const properties = block.properties ?? {}

      this.compileBlockProperties(properties, String(blockType), emitter, propsVar, idVar, codeExpr)

      this.pushResolveBlockWorkTask(emitter, 'blocks', idVar, String(block.variant), String(blockType), propsVar)
    })
  }

  /**
   * Emits a call to the shared field value resolver for one block's properties.
   */
  private compileFieldValueResolution(emitter: CodeEmitter, propsVar: string): void {
    emitter.comment('StepResolveCompiler.compileFieldValueResolution')
    emitter.code(`${GENERATED_FUNCTION_HELPERS_PARAM}.resolveFieldValue(ctx, ${propsVar});`)
  }

  /**
   * Emits a call to the shared field failure resolver for one block's properties.
   */
  private compileFieldFailureResolution(emitter: CodeEmitter, blockIdExpr: string, propsVar: string): void {
    emitter.comment('StepResolveCompiler.compileFieldFailureResolution')
    emitter.code(`${GENERATED_FUNCTION_HELPERS_PARAM}.resolveFieldFailures(ctx, ${blockIdExpr}, ${propsVar});`)
  }

  /**
   * Emits one evaluated property assignment through the shared runtime value compiler.
   */
  private compileBlockProperties(
    properties: Record<string, unknown>,
    blockType: string,
    emitter: CodeEmitter,
    propsVar: string,
    blockIdExpr: string,
    codeExpr?: string,
  ): void {
    const hasVisibleWhen = 'visibleWhen' in properties
    const hoistedKeys = new Set<string>()

    if (hasVisibleWhen) {
      this.compilePropertyAssignment(properties.visibleWhen, emitter, propsVar, 'visibleWhen')
      hoistedKeys.add('visibleWhen')
    }

    if (hasVisibleWhen && blockType === BlockType.FIELD && 'code' in properties) {
      this.fieldCodes.assignProperty(properties.code, emitter, propsVar, 'code', codeExpr)
      hoistedKeys.add('code')
    }

    const compileRemainingProperties = () => {
      for (const [key, value] of Object.entries(properties)) {
        if (StepResolveCompiler.BLOCK_SKIP_PROPS.has(key) || hoistedKeys.has(key)) {
          continue
        }

        if (blockType === BlockType.FIELD && key === 'code') {
          this.fieldCodes.assignProperty(value, emitter, propsVar, key, codeExpr)

          continue
        }

        this.compilePropertyAssignment(value, emitter, propsVar, key)
      }

      if (blockType === BlockType.FIELD) {
        if (properties.value === undefined) {
          this.compileFieldValueResolution(emitter, propsVar)
        }

        this.compileFieldFailureResolution(emitter, blockIdExpr, propsVar)
      }
    }

    if (hasVisibleWhen) {
      emitter.if(`${propsVar}["visibleWhen"] !== false`, compileRemainingProperties)
    } else {
      compileRemainingProperties()
    }
  }

  private compilePropertyAssignment(value: unknown, emitter: CodeEmitter, targetObj: string, key: string): void {
    this.values.compileAssignment(value, emitter, targetObj, key)
  }

  /**
   * Gives render-specific nested blocks first chance at value compilation.
   *
   * Returns true when the value was a render block and code has been emitted
   * into resultVar. Returns false when the generic value compiler should handle
   * the value normally.
   */
  private tryCompileResolveBlockValue(value: unknown, emitter: CodeEmitter, resultVar: string): boolean {
    if (this.expr.isTemplateNode(value)) {
      if (value.originalType !== ASTNodeType.BLOCK) {
        return false
      }

      this.compileTemplateNestedBlock(value, emitter, resultVar)

      return true
    }

    if (!this.isResolveBlockObject(value)) {
      return false
    }

    this.compileNestedBlock(value, emitter, resultVar)

    return true
  }

  /**
   * Emits a nested block object used as a property value, such as a conditional reveal.
   */
  private compileNestedBlock(block: ResolveBlockValue, emitter: CodeEmitter, resultVar: string): void {
    emitter.comment('StepResolveCompiler.compileNestedBlock')
    const properties = block.properties ?? {}
    const blockType = block.blockType

    emitter.scope(() => {
      const idVar = emitter.const('resolveBlockId', JSON.stringify(block.id))
      const propsVar = emitter.const('nestedBlockProps', '{}')

      Object.entries(properties).forEach(([key, value]) => {
        if (StepResolveCompiler.BLOCK_SKIP_PROPS.has(key)) {
          return
        }

        if (blockType === BlockType.FIELD && key === 'code') {
          this.fieldCodes.assignProperty(value, emitter, propsVar, key)

          return
        }

        this.compilePropertyAssignment(value, emitter, propsVar, key)
      })

      if (blockType === BlockType.FIELD) {
        if (properties.value === undefined) {
          this.compileFieldValueResolution(emitter, propsVar)
        }

        this.compileFieldFailureResolution(emitter, idVar, propsVar)
      }

      this.assignResolveBlockWorkTask(emitter, resultVar, idVar, block.variant, blockType, propsVar)
    })
  }

  /**
   * Emits a nested template block produced inside an iterator yield.
   */
  private compileTemplateNestedBlock(block: TemplateNode, emitter: CodeEmitter, resultVar: string): void {
    emitter.comment('StepResolveCompiler.compileTemplateNestedBlock')
    const blockType = block.blockType

    const properties = block.properties ?? {}

    emitter.scope(() => {
      const idVar = emitter.const('resolveBlockId', this.templates.compileTemplateInstanceIdExpression(block))
      const propsVar = emitter.const('templateNestedBlockProps', '{}')

      Object.entries(properties).forEach(([key, value]) => {
        if (StepResolveCompiler.BLOCK_SKIP_PROPS.has(key)) {
          return
        }

        if (blockType === BlockType.FIELD && key === 'code') {
          this.fieldCodes.assignProperty(value, emitter, propsVar, key)

          return
        }

        this.compilePropertyAssignment(value, emitter, propsVar, key)
      })

      if (blockType === BlockType.FIELD) {
        if (properties.value === undefined) {
          this.compileFieldValueResolution(emitter, propsVar)
        }

        this.compileFieldFailureResolution(emitter, idVar, propsVar)
      }

      this.assignResolveBlockWorkTask(emitter, resultVar, idVar, String(block.variant), String(blockType), propsVar)
    })
  }

  private pushResolveBlockWorkTask(
    emitter: CodeEmitter,
    targetArrayVar: string,
    idVar: string,
    variant: string,
    blockType: string,
    propsVar: string,
  ): void {
    emitter.code(
      `${targetArrayVar}.push(${this.compileResolveBlockWorkTaskExpression(idVar, variant, blockType, propsVar)});`,
    )
  }

  private assignResolveBlockWorkTask(
    emitter: CodeEmitter,
    resultVar: string,
    idVar: string,
    variant: string,
    blockType: string,
    propsVar: string,
  ): void {
    emitter.assign(resultVar, this.compileResolveBlockWorkTaskExpression(idVar, variant, blockType, propsVar))
  }

  private compileResolveBlockWorkTaskExpression(
    idVar: string,
    variant: string,
    blockType: string,
    propsVar: string,
  ): string {
    return `ctx.workTasks.resolveBlock(${idVar}, ${JSON.stringify(variant)}, ${JSON.stringify(blockType)}, ${propsVar})`
  }

  /**
   * Wraps the step's blocks, metadata, and ancestors in the resolve-blocks root
   * task so the terminal runs the same executor driver as every other phase.
   */
  private compileResolveBlocksWorkTaskExpression(): string {
    return 'ctx.workTasks.resolveBlocks(blocks, step, ancestors)'
  }

  /**
   * Identifies values the render compiler must own because they have block semantics.
   */
  private isResolveBlockValue(value: unknown): boolean {
    if (this.expr.isTemplateNode(value)) {
      return value.originalType === ASTNodeType.BLOCK
    }

    return this.isResolveBlockObject(value)
  }

  /**
   * Type guard for block-shaped objects embedded directly in authored properties.
   */
  private isResolveBlockObject(value: unknown): value is ResolveBlockValue {
    if (value === null || value === undefined || typeof value !== 'object') {
      return false
    }

    const obj = value as Record<string, unknown>

    return obj.type === ASTNodeType.BLOCK && typeof obj.variant === 'string' && typeof obj.blockType === 'string'
  }

  /**
   * Finds block templates before loop emission because yielded blocks can sit below arrays or objects.
   */
  private findTemplateBlocks(template: TemplateValue): TemplateNode[] {
    return this.templates.findTemplateNodes(template, isTemplateBlockNode, { descendIntoMatches: false })
  }
}
