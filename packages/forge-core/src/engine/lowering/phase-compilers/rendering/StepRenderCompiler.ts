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
  CompiledStepMetadataFunction,
} from '../../../contracts/compiled/compiledFunctions.type'
import type {
  CompiledIteratorRenderBlock,
  IteratorRenderBlockGroup,
  CompiledRenderBlock,
  RenderPlan,
} from '../../../contracts/plans/compilationArtefacts.type'

/**
 * Shape of a block-typed AST value embedded directly inside an authored
 * property (for example a conditional reveal), distinguished from generic
 * values by its BLOCK node type so the render compiler can own its lowering.
 */
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
   * Compiles a step into its RenderPlan: optional step and ancestor metadata
   * functions, one CompiledRenderBlockFunction per top-level block, and a render
   * group per block-yielding MAP iterator.
   *
   * Block-yielding iterates consumed inline as property values are tracked while
   * compiling blocks and skipped here so they are not emitted a second time as
   * top-level iterator groups.
   */
  compileRenderPlan(
    stepNode: StepASTNode,
    ancestorNodes: JourneyASTNode[],
    iterateNodes: IterateASTNode[] = [],
  ): RenderPlan {
    this.inlineIterateIds.clear()

    const compiledStepMetadata = this.compileStepMetadataFunction(stepNode)
    const compiledAncestorMetadata = this.compileAncestorMetadataFunction(ancestorNodes)

    const blocks: CompiledRenderBlock[] = (stepNode.properties.blocks ?? []).map(block => ({
      nodeId: block.id,
      variant: block.variant,
      render: this.compileBlock(block),
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

    return {
      compiledStepMetadata,
      compiledAncestorMetadata,
      renderBlocks: blocks,
      iteratorRenderBlockGroups: iteratorGroups,
    }
  }

  /**
   * Compiles the step metadata function, or undefined when the step carries no
   * renderable metadata once executable structure (hooks, blocks, reachability)
   * is excluded.
   */
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

  /**
   * Builds the JS source string for the step metadata function, returning a
   * `step` object of evaluated metadata properties.
   */
  private buildStepMetadataSource(stepNode: StepASTNode): string {
    const emitter = CodeEmitter.strict()
    emitter.comment('StepRenderCompiler.buildStepMetadataSource')
    emitter.declareConst('step', '{}')

    this.compileStepMetadata(stepNode, emitter)

    emitter.return('step')

    return emitter.toString()
  }

  /**
   * Compiles the ancestor metadata function, or undefined when the step has no
   * journey ancestors.
   */
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

  /**
   * Builds the JS source for the ancestor metadata function, returning an
   * `ancestors` array ordered root-first with each ancestor's path composed
   * relative to its parents.
   */
  private buildAncestorMetadataSource(ancestorNodes: JourneyASTNode[]): string {
    const emitter = CodeEmitter.strict()
    emitter.comment('StepRenderCompiler.buildAncestorMetadataSource')
    emitter.declareConst('ancestors', '[]')

    this.compileAncestorMetadata(ancestorNodes, emitter)

    emitter.return('ancestors')

    return emitter.toString()
  }

  /**
   * Compiles one top-level block into a function producing a single RenderBlock.
   */
  private compileBlock(block: BlockASTNode): CompiledRenderBlockFunction {
    return compileGeneratedFunction<CompiledRenderBlockFunction>(
      this.expr,
      ['ctx'],
      () => this.buildBlockSource(block),
      { phase: 'render' },
    )
  }

  /**
   * Builds the JS source for one block's render function: evaluates each
   * authored property (skipping non-render concerns) and returns a branded
   * RenderBlock. Field blocks compile their code expression and resolve the
   * answer value when no explicit value is authored.
   */
  private buildBlockSource(block: BlockASTNode): string {
    const emitter = CodeEmitter.strict()
    emitter.comment('StepRenderCompiler.buildBlockSource')

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

  /**
   * Compiles a block-yielding MAP iterate into a render group pairing its input
   * evaluator with one render function per leaf block. Returns undefined for
   * non-MAP iterators, iterators with no yield template, or templates that yield
   * no blocks.
   */
  private compileIteratorRenderGroup(iterateNode: IterateASTNode): IteratorRenderBlockGroup | undefined {
    if (iterateNode.properties.iterator.type !== IteratorType.MAP) {
      return undefined
    }

    const template = iterateNode.properties.iterator.yieldTemplate

    if (template === undefined) {
      return undefined
    }

    const blocks: CompiledIteratorRenderBlock[] = []

    this.collectLeafBlocks(template, blocks, [])

    if (blocks.length === 0) {
      return undefined
    }

    const evaluateInput = this.compileIteratorInputEvaluator(iterateNode)

    return { nodeId: iterateNode.id, evaluateInput, blocks }
  }

  /**
   * Walks a yield template collecting each leaf block into `entries`, recursing
   * through nested MAP iterates without descending past matched nodes. Each leaf
   * is compiled with the chain of enclosing iterates so it can emit its own
   * inline loops, accumulated outermost-first in `ancestorIterates`.
   */
  private collectLeafBlocks(
    template: TemplateValue,
    entries: CompiledIteratorRenderBlock[],
    ancestorIterates: readonly TemplateNode[],
  ): void {
    const directNodes = this.templates.findTemplateNodes(
      template,
      node => isTemplateBlockNode(node) || isTemplateIterateNode(node),
      { descendIntoMatches: false },
    )

    directNodes.forEach(node => {
      if (isTemplateBlockNode(node)) {
        entries.push({
          nodeId: node.id,
          variant: node.variant as string,
          render: this.compileIteratorRenderBlock(node, ancestorIterates),
        })

        return
      }

      const yieldTemplate = this.templates.getMapIterateYieldTemplate(node)

      if (yieldTemplate !== undefined) {
        this.collectLeafBlocks(yieldTemplate, entries, [...ancestorIterates, node])
      }
    })
  }

  /**
   * Compiles the function that evaluates an iterate's input into the per-item
   * IteratorItemScope array driving the group's render blocks.
   */
  private compileIteratorInputEvaluator(iterateNode: IterateASTNode): CompiledIteratorInputFunction {
    return compileGeneratedFunction<CompiledIteratorInputFunction>(
      this.expr,
      ['ctx'],
      () => this.buildIteratorInputEvaluatorSource(iterateNode),
      { phase: 'iterator-input' },
    )
  }

  /**
   * Builds the JS source for an iterate input evaluator: normalizes the input
   * (objects become keyed entries, arrays drop nullish items), then returns one
   * scope per surviving item carrying item, index, rawItem, and inputLength.
   * A non-array input yields an empty array.
   */
  private buildIteratorInputEvaluatorSource(iterateNode: IterateASTNode): string {
    const emitter = CodeEmitter.strict()
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

  /**
   * Compiles one leaf block of an iterate render group into a function invoked
   * once per outer IteratorItemScope. The result is a single RenderBlock when
   * the block is directly under the group's iterate, or a RenderBlock array when
   * intermediate iterates expand into inline loops.
   */
  private compileIteratorRenderBlock(
    block: TemplateNode,
    ancestorIterates: readonly TemplateNode[],
  ): CompiledIteratorRenderBlockFunction {
    return compileGeneratedFunction<CompiledIteratorRenderBlockFunction>(
      this.expr,
      ['ctx', 'iteratorScope'],
      () => this.buildIteratorRenderBlockSource(block, ancestorIterates),
      { phase: 'render' },
    )
  }

  /**
   * Builds the JS source for an iterate render block under the outer scope
   * frame bound to the passed-in iteratorScope argument. With no intermediate
   * iterates it returns one RenderBlock; otherwise it pushes blocks into a
   * `nestedBlocks` array as each intermediate iterate's inline loops run, and
   * returns that array.
   */
  private buildIteratorRenderBlockSource(block: TemplateNode, ancestorIterates: readonly TemplateNode[]): string {
    const emitter = CodeEmitter.strict()
    emitter.comment('StepRenderCompiler.buildIteratorRenderBlockSource')

    const outerFrame: IteratorScopeFrame = {
      itemVar: 'iteratorScope.item',
      indexVar: 'iteratorScope.index',
      inputLengthExpr: 'iteratorScope.inputLength',
      rawItemExpr: 'iteratorScope.rawItem',
    }

    this.expr.withIteratorFrame(outerFrame, () => {
      if (ancestorIterates.length === 0) {
        this.emitRenderBlock(block, emitter, true)

        return
      }

      emitter.declareConst('nestedBlocks', '[]')
      this.emitNestedLoopsAndCompileBlock(block, ancestorIterates, 0, emitter)
      emitter.return('nestedBlocks')
    })

    return emitter.toString()
  }

  /**
   * Emits one inline MAP loop per intermediate iterate from `depth` downward,
   * each pushing an iterator frame for its nesting level, then emits the leaf
   * block (pushed onto `nestedBlocks`) at the innermost depth.
   */
  private emitNestedLoopsAndCompileBlock(
    block: TemplateNode,
    ancestorIterates: readonly TemplateNode[],
    depth: number,
    emitter: CodeEmitter,
  ): void {
    if (depth >= ancestorIterates.length) {
      this.emitRenderBlock(block, emitter, false)

      return
    }

    this.templates.compileTemplateMapIterator(ancestorIterates[depth], emitter, () => {
      this.emitNestedLoopsAndCompileBlock(block, ancestorIterates, depth + 1, emitter)
    })
  }

  /**
   * Emits the branded RenderBlock for a leaf template block, evaluating its
   * authored properties under the active iterator frames. Field blocks derive a
   * per-item id from their resolved code and resolve the answer value when none
   * is authored. When `asReturn` is true the block is returned; otherwise it is
   * pushed onto `nestedBlocks`.
   */
  private emitRenderBlock(block: TemplateNode, emitter: CodeEmitter, asReturn: boolean): void {
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

    const blockExpr = `{
          [${GENERATED_FUNCTION_HELPERS_PARAM}.renderBlockBrand]: true,
          id: ${idExpr},
          variant: ${JSON.stringify(block.variant)},
          blockType: ${JSON.stringify(blockType)},
          properties: ${propsVar}
        }`

    if (asReturn) {
      emitter.return(blockExpr)
    } else {
      emitter.code(`nestedBlocks.push(${blockExpr});`)
    }
  }
}
