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
import { ASTNodeType } from '../../../contracts/ast/enums'
import { BlockType, IteratorType } from '../../../../authoring/types/enums'
import { BlockASTNode, JourneyASTNode, StepASTNode } from '../../../contracts/ast/structures.type'
import { IterateASTNode } from '../../../contracts/ast/expressions.type'
import { TemplateNode, TemplateValue } from '../../../contracts/ast/template.type'
import CodeEmitter from '../../emitters/CodeEmitter'
import FieldCodeEmitter from '../../emitters/FieldCodeEmitter'
import ExpressionDispatcher from '../../expressions/ExpressionDispatcher'
import {
  buildGeneratedSource,
  compileGeneratedFunction,
  GENERATED_FUNCTION_HELPERS_PARAM,
} from '../../function-construction/GeneratedFunctionCompiler'
import ScopedTemplateCompiler, {
  isTemplateBlockNode,
  isTemplateIterateNode,
} from '../../structures/ScopedTemplateCompiler'
import RuntimeValueCompiler from '../../structures/RuntimeValueCompiler'
import type { CompilationDependencies } from '../../compilationDependencies.type'
import type { IteratorScopeFrame } from '../../expressions/ExpressionDispatcher'

import type {
  CompiledAncestorMetadataFunction,
  CompiledIteratorInputFunction,
  CompiledIteratorRenderBlockFunction,
  CompiledRenderBlockFunction,
  CompiledRenderFunction,
  CompiledStepMetadataFunction,
} from '../../../contracts/compiled/compiledFunctions.type'
import type {
  IteratorRenderBlockEntry,
  IteratorRenderBlockGroup,
  RenderBlockEntry,
  RenderPlan,
} from '../../../contracts/plans/compilationArtefacts.type'

interface RenderBlockValue {
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
export default class StepRenderCompiler {
  // These properties affect answer prep or validation, not rendered block props.
  private static readonly BLOCK_SKIP_PROPS = new Set(['formatters', 'parsers', 'validWhen', 'dependentWhen'])

  // Hooks, blocks, and reachability are executable structure, not render metadata.
  private static readonly STEP_SKIP_PROPS = new Set(['onAccess', 'onSubmission', 'blocks', 'reachability'])

  // Child structure and access hooks are route/lifecycle concerns, not metadata.
  private static readonly JOURNEY_SKIP_PROPS = new Set(['onAccess', 'children', 'steps', 'reachability'])

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
      isStructuralValue: value => this.isRenderBlockValue(value),
      compileStructuralValue: (value, emitter, targetVar) => this.tryCompileRenderBlockValue(value, emitter, targetVar),
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
  ): CompiledRenderFunction | undefined {
    return compileGeneratedFunction<CompiledRenderFunction>(
      this.expr,
      ['ctx'],
      () => this.buildSource(stepNode, ancestorNodes, iterateNodes),
      { phase: 'render' },
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

    emitter.comment('StepRenderCompiler.buildSource')
    emitter.declareConst('blocks', '[]')
    emitter.declareConst('step', '{}')
    emitter.declareConst('ancestors', '[]')

    this.compileStepMetadata(stepNode, emitter)

    this.compileAncestorMetadata(ancestorNodes, emitter)

    this.compileBlocks(stepNode.properties.blocks ?? [], emitter)

    this.compileIterateBlocks(iterateNodes, emitter)

    emitter.return('{ blocks: blocks, step: step, ancestors: ancestors }')

    return emitter.toString()
  }

  /**
   * Emits evaluated step metadata while excluding executable structure owned by other compilers.
   */
  private compileStepMetadata(stepNode: StepASTNode, emitter: CodeEmitter): void {
    emitter.comment('StepRenderCompiler.compileStepMetadata')

    for (const [key, value] of Object.entries(stepNode.properties)) {
      if (StepRenderCompiler.STEP_SKIP_PROPS.has(key)) {
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

    emitter.comment('StepRenderCompiler.compileAncestorMetadata')
    emitter.declareLet('composedPath', '""')

    for (let i = 0; i < ancestorNodes.length; i++) {
      const ancestor = ancestorNodes[i]

      emitter.scope(() => {
        const ancestorVar = emitter.const('ancestor', '{}')

        for (const [key, value] of Object.entries(ancestor.properties)) {
          if (StepRenderCompiler.JOURNEY_SKIP_PROPS.has(key)) {
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

    emitter.comment('StepRenderCompiler.compileBlocks')

    for (const block of blocks) {
      this.compileBlock(block, emitter, 'blocks')
      emitter.emitBlank()
    }
  }

  /**
   * Emits one registered block, including evaluated properties and field value fallback.
   */
  private compileBlock(block: BlockASTNode, emitter: CodeEmitter, targetArrayVar: string): void {
    emitter.comment('StepRenderCompiler.compileBlock')
    emitter.scope(() => {
      const propsVar = emitter.const('blockProps', '{}')

      for (const [key, value] of Object.entries(block.properties)) {
        if (StepRenderCompiler.BLOCK_SKIP_PROPS.has(key)) {
          continue
        }

        if (block.blockType === BlockType.FIELD && key === 'code') {
          this.fieldCodes.assignProperty(value, emitter, propsVar, key)

          continue
        }

        this.compilePropertyAssignment(value, emitter, propsVar, key)
      }

      if (block.blockType === BlockType.FIELD && block.properties.value === undefined) {
        this.compileFieldValueResolution(emitter, propsVar)
      }

      emitter.code(
        `${targetArrayVar}.push({
          [${GENERATED_FUNCTION_HELPERS_PARAM}.renderBlockBrand]: true,
          id: ${JSON.stringify(block.id)},
          variant: ${JSON.stringify(block.variant)},
          blockType: ${JSON.stringify(block.blockType)},
          properties: ${propsVar}
        });`,
      )
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
   * Emits the iterator loop used when a MAP expression yields render blocks.
   */
  private compileMapIteratorBlocks(
    iterateNode: IterateASTNode,
    templateBlocks: TemplateNode[],
    emitter: CodeEmitter,
  ): void {
    emitter.comment('StepRenderCompiler.compileMapIteratorBlocks')
    this.templates.compileMapIterator(iterateNode, emitter, () => {
      templateBlocks.forEach(templateBlock => {
        const codeExpr = this.templates.compileTemplateCodeExpression(templateBlock, emitter)

        this.compileTemplateBlock(templateBlock, codeExpr, emitter)
      })
    })
  }

  /**
   * Emits a template block inside an iterator loop.
   *
   * FIELD blocks use "compiled:" + fieldCode so validation failures that carry
   * blockCode can attach to the rendered block deterministically.
   */
  private compileTemplateBlock(block: TemplateNode, codeExpr: string | undefined, emitter: CodeEmitter): void {
    emitter.comment('StepRenderCompiler.compileTemplateBlock')
    const blockType = block.blockType

    emitter.scope(() => {
      const propsVar = emitter.const('templateBlockProps', '{}')
      const properties = block.properties ?? {}

      for (const [key, value] of Object.entries(properties)) {
        if (StepRenderCompiler.BLOCK_SKIP_PROPS.has(key)) {
          continue
        }

        if (blockType === BlockType.FIELD && key === 'code') {
          this.fieldCodes.assignProperty(value, emitter, propsVar, key, codeExpr)

          continue
        }

        this.compilePropertyAssignment(value, emitter, propsVar, key)
      }

      if (blockType === BlockType.FIELD && properties.value === undefined) {
        this.compileFieldValueResolution(emitter, propsVar)
      }

      const idExpr =
        blockType === BlockType.FIELD
          ? this.fieldCodes.compileIteratorFieldBlockIdExpression(codeExpr, String(block.id))
          : JSON.stringify(`compiled:${String(block.id)}`)

      emitter.code(
        `blocks.push({
          [${GENERATED_FUNCTION_HELPERS_PARAM}.renderBlockBrand]: true,
          id: ${idExpr},
          variant: ${JSON.stringify(block.variant)},
          blockType: ${JSON.stringify(blockType)},
          properties: ${propsVar}
        });`,
      )
    })
  }

  /**
   * Emits a call to the shared field value resolver for one block's properties.
   */
  private compileFieldValueResolution(emitter: CodeEmitter, propsVar: string): void {
    emitter.comment('StepRenderCompiler.compileFieldValueResolution')
    emitter.code(`${GENERATED_FUNCTION_HELPERS_PARAM}.resolveFieldValue(ctx, ${propsVar});`)
  }

  /**
   * Emits one evaluated property assignment through the shared runtime value compiler.
   */
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
  private tryCompileRenderBlockValue(value: unknown, emitter: CodeEmitter, resultVar: string): boolean {
    if (this.expr.isTemplateNode(value)) {
      if (value.originalType !== ASTNodeType.BLOCK) {
        return false
      }

      this.compileTemplateNestedBlock(value, emitter, resultVar)

      return true
    }

    if (!this.isRenderBlockObject(value)) {
      return false
    }

    this.compileNestedBlock(value, emitter, resultVar)

    return true
  }

  /**
   * Emits a nested block object used as a property value, such as a conditional reveal.
   */
  private compileNestedBlock(block: RenderBlockValue, emitter: CodeEmitter, resultVar: string): void {
    emitter.comment('StepRenderCompiler.compileNestedBlock')
    const properties = block.properties ?? {}
    const blockType = block.blockType

    emitter.scope(() => {
      const propsVar = emitter.const('nestedBlockProps', '{}')

      Object.entries(properties).forEach(([key, value]) => {
        if (StepRenderCompiler.BLOCK_SKIP_PROPS.has(key)) {
          return
        }

        if (blockType === BlockType.FIELD && key === 'code') {
          this.fieldCodes.assignProperty(value, emitter, propsVar, key)

          return
        }

        this.compilePropertyAssignment(value, emitter, propsVar, key)
      })

      if (blockType === BlockType.FIELD && properties.value === undefined) {
        this.compileFieldValueResolution(emitter, propsVar)
      }

      emitter.assign(
        resultVar,
        `{
          [${GENERATED_FUNCTION_HELPERS_PARAM}.renderBlockBrand]: true,
          id: ${JSON.stringify(block.id)},
          variant: ${JSON.stringify(block.variant)},
          blockType: ${JSON.stringify(blockType)},
          properties: ${propsVar}
        }`,
      )
    })
  }

  /**
   * Emits a nested template block produced inside an iterator yield.
   */
  private compileTemplateNestedBlock(block: TemplateNode, emitter: CodeEmitter, resultVar: string): void {
    emitter.comment('StepRenderCompiler.compileTemplateNestedBlock')
    const blockType = block.blockType

    const properties = block.properties ?? {}

    emitter.scope(() => {
      const propsVar = emitter.const('templateNestedBlockProps', '{}')

      Object.entries(properties).forEach(([key, value]) => {
        if (StepRenderCompiler.BLOCK_SKIP_PROPS.has(key)) {
          return
        }

        if (blockType === BlockType.FIELD && key === 'code') {
          this.fieldCodes.assignProperty(value, emitter, propsVar, key)

          return
        }

        this.compilePropertyAssignment(value, emitter, propsVar, key)
      })

      if (blockType === BlockType.FIELD && properties.value === undefined) {
        this.compileFieldValueResolution(emitter, propsVar)
      }

      // The code property has already been compiled into propsVar at this point.
      const idExpr =
        blockType === BlockType.FIELD
          ? this.fieldCodes.compileIteratorFieldBlockIdExpression(`${propsVar}["code"]`, String(block.id))
          : JSON.stringify(block.id)

      emitter.assign(
        resultVar,
        `{
          [${GENERATED_FUNCTION_HELPERS_PARAM}.renderBlockBrand]: true,
          id: ${idExpr},
          variant: ${JSON.stringify(block.variant)},
          blockType: ${JSON.stringify(blockType)},
          properties: ${propsVar}
        }`,
      )
    })
  }

  /**
   * Identifies values the render compiler must own because they have block semantics.
   */
  private isRenderBlockValue(value: unknown): boolean {
    if (this.expr.isTemplateNode(value)) {
      return value.originalType === ASTNodeType.BLOCK
    }

    return this.isRenderBlockObject(value)
  }

  /**
   * Type guard for block-shaped objects embedded directly in authored properties.
   */
  private isRenderBlockObject(value: unknown): value is RenderBlockValue {
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

  compileRenderPlan(
    stepNode: StepASTNode,
    ancestorNodes: JourneyASTNode[],
    iterateNodes: IterateASTNode[] = [],
  ): RenderPlan {
    this.inlineIterateIds.clear()

    const compiledStepMetadata = this.compileStepMetadataFunction(stepNode)
    const compiledAncestorMetadata = this.compileAncestorMetadataFunction(ancestorNodes)

    const blocks: RenderBlockEntry[] = (stepNode.properties.blocks ?? []).map(block => ({
      nodeId: block.id,
      render: this.compileSingleBlock(block),
    }))

    const iteratorGroups: IteratorRenderBlockGroup[] = []

    for (const iterateNode of iterateNodes) {
      if (this.inlineIterateIds.has(iterateNode.id)) {
        continue
      }

      const group = this.compileIteratorRenderGroup(iterateNode)

      if (group !== undefined) {
        iteratorGroups.push(group)
      }
    }

    return { compiledStepMetadata, compiledAncestorMetadata, blocks, iteratorGroups }
  }

  private compileStepMetadataFunction(stepNode: StepASTNode): CompiledStepMetadataFunction | undefined {
    const hasProperties = Object.keys(stepNode.properties).some(key => !StepRenderCompiler.STEP_SKIP_PROPS.has(key))

    if (!hasProperties) {
      return undefined
    }

    return compileGeneratedFunction<CompiledStepMetadataFunction>(
      this.expr,
      ['ctx'],
      () => this.buildStepMetadataSource(stepNode),
      { phase: 'render' },
    )
  }

  private buildStepMetadataSource(stepNode: StepASTNode): string {
    const emitter = new CodeEmitter()

    emitter.code('"use strict";')
    emitter.comment('StepRenderCompiler.buildStepMetadataSource')
    emitter.declareConst('step', '{}')

    this.compileStepMetadata(stepNode, emitter)

    emitter.return('step')

    return emitter.toString()
  }

  private compileAncestorMetadataFunction(
    ancestorNodes: JourneyASTNode[],
  ): CompiledAncestorMetadataFunction | undefined {
    if (ancestorNodes.length === 0) {
      return undefined
    }

    return compileGeneratedFunction<CompiledAncestorMetadataFunction>(
      this.expr,
      ['ctx'],
      () => this.buildAncestorMetadataSource(ancestorNodes),
      { phase: 'render' },
    )
  }

  private buildAncestorMetadataSource(ancestorNodes: JourneyASTNode[]): string {
    const emitter = new CodeEmitter()

    emitter.code('"use strict";')
    emitter.comment('StepRenderCompiler.buildAncestorMetadataSource')
    emitter.declareConst('ancestors', '[]')

    this.compileAncestorMetadata(ancestorNodes, emitter)

    emitter.return('ancestors')

    return emitter.toString()
  }

  private compileSingleBlock(block: BlockASTNode): CompiledRenderBlockFunction {
    return compileGeneratedFunction<CompiledRenderBlockFunction>(
      this.expr,
      ['ctx'],
      () => this.buildSingleBlockSource(block),
      { phase: 'render' },
    )
  }

  private buildSingleBlockSource(block: BlockASTNode): string {
    const emitter = new CodeEmitter()

    emitter.code('"use strict";')
    emitter.comment('StepRenderCompiler.buildSingleBlockSource')

    const propsVar = emitter.const('blockProps', '{}')

    for (const [key, value] of Object.entries(block.properties)) {
      if (StepRenderCompiler.BLOCK_SKIP_PROPS.has(key)) {
        continue
      }

      if (block.blockType === BlockType.FIELD && key === 'code') {
        this.fieldCodes.assignProperty(value, emitter, propsVar, key)

        continue
      }

      this.compilePropertyAssignment(value, emitter, propsVar, key)
    }

    if (block.blockType === BlockType.FIELD && block.properties.value === undefined) {
      this.compileFieldValueResolution(emitter, propsVar)
    }

    emitter.return(
      `{
        [${GENERATED_FUNCTION_HELPERS_PARAM}.renderBlockBrand]: true,
        id: ${JSON.stringify(block.id)},
        variant: ${JSON.stringify(block.variant)},
        blockType: ${JSON.stringify(block.blockType)},
        properties: ${propsVar}
      }`,
    )

    return emitter.toString()
  }

  private compileIteratorRenderGroup(iterateNode: IterateASTNode): IteratorRenderBlockGroup | undefined {
    if (iterateNode.properties.iterator.type !== IteratorType.MAP) {
      return undefined
    }

    const template = iterateNode.properties.iterator.yieldTemplate

    if (template === undefined) {
      return undefined
    }

    const directBlocks = this.findDirectTemplateBlocks(template)

    if (directBlocks.length === 0) {
      return undefined
    }

    const evaluateInput = this.compileIteratorInputEvaluator(iterateNode)
    const blocks: IteratorRenderBlockEntry[] = directBlocks.map(block => ({
      templateNodeId: String(block.id),
      render: this.compileIteratorRenderBlock(block),
    }))

    return { nodeId: iterateNode.id, evaluateInput, blocks }
  }

  private compileIteratorInputEvaluator(iterateNode: IterateASTNode): CompiledIteratorInputFunction {
    return compileGeneratedFunction<CompiledIteratorInputFunction>(
      this.expr,
      ['ctx'],
      () => this.buildIteratorInputEvaluatorSource(iterateNode),
      { phase: 'iterator-input' },
    )
  }

  private buildIteratorInputEvaluatorSource(iterateNode: IterateASTNode): string {
    const emitter = new CodeEmitter()

    emitter.code('"use strict";')
    emitter.comment('StepRenderCompiler.buildIteratorInputEvaluatorSource')

    const inputVar = emitter.let('iteratorInput', this.expr.compileOperand(iterateNode.properties.input))

    this.templates.compileNormalizeIteratorInput(inputVar, emitter)

    emitter.declareConst('result', '[]')
    emitter.if(`Array.isArray(${inputVar})`, () => {
      const indexVar = emitter.let('i', '0')

      emitter.while(`${indexVar} < ${inputVar}.length`, () => {
        const rawItemVar = emitter.const('rawItem', `${inputVar}[${indexVar}]`)

        emitter.assign(indexVar, `${indexVar} + 1`)
        emitter.if(`${rawItemVar} == null`, () => emitter.continue())

        const itemVar = emitter.const('item', this.templates.compileIteratorItemScope(rawItemVar))

        emitter.code(
          `result.push({ item: ${itemVar}, index: ${indexVar} - 1, rawItem: ${rawItemVar}, inputLength: ${inputVar}.length });`,
        )
      })
    })
    emitter.emitBlank()
    emitter.return('result')

    return emitter.toString()
  }

  private compileIteratorRenderBlock(block: TemplateNode): CompiledIteratorRenderBlockFunction {
    return compileGeneratedFunction<CompiledIteratorRenderBlockFunction>(
      this.expr,
      ['ctx', 'iteratorScope'],
      () => this.buildIteratorRenderBlockSource(block),
      { phase: 'render' },
    )
  }

  private buildIteratorRenderBlockSource(block: TemplateNode): string {
    const emitter = new CodeEmitter()

    emitter.code('"use strict";')
    emitter.comment('StepRenderCompiler.buildIteratorRenderBlockSource')

    const frame: IteratorScopeFrame = {
      itemVar: 'iteratorScope.item',
      indexVar: 'iteratorScope.index',
      inputLengthExpr: 'iteratorScope.inputLength',
      rawItemExpr: 'iteratorScope.rawItem',
    }

    this.expr.withIteratorFrame(frame, () => {
      const blockType = block.blockType
      const codeExpr = this.templates.compileTemplateCodeExpression(block, emitter)
      const propsVar = emitter.const('templateBlockProps', '{}')
      const properties = block.properties ?? {}

      for (const [key, value] of Object.entries(properties)) {
        if (StepRenderCompiler.BLOCK_SKIP_PROPS.has(key)) {
          continue
        }

        if (blockType === BlockType.FIELD && key === 'code') {
          this.fieldCodes.assignProperty(value, emitter, propsVar, key, codeExpr)

          continue
        }

        this.compilePropertyAssignment(value, emitter, propsVar, key)
      }

      if (blockType === BlockType.FIELD && properties.value === undefined) {
        this.compileFieldValueResolution(emitter, propsVar)
      }

      const idExpr =
        blockType === BlockType.FIELD
          ? this.fieldCodes.compileIteratorFieldBlockIdExpression(codeExpr, String(block.id))
          : JSON.stringify(`compiled:${String(block.id)}`)

      emitter.return(
        `{
          [${GENERATED_FUNCTION_HELPERS_PARAM}.renderBlockBrand]: true,
          id: ${idExpr},
          variant: ${JSON.stringify(block.variant)},
          blockType: ${JSON.stringify(blockType)},
          properties: ${propsVar}
        }`,
      )
    })

    return emitter.toString()
  }

  private findDirectTemplateBlocks(template: TemplateValue): TemplateNode[] {
    return this.templates
      .findTemplateNodes(template, node => isTemplateBlockNode(node) || isTemplateIterateNode(node), {
        descendIntoMatches: false,
      })
      .filter(node => isTemplateBlockNode(node))
  }
}
