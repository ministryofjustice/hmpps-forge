/**
 * Compiles render context evaluation for one step.
 *
 * The generated function builds evaluated step metadata, journey ancestor
 * metadata, and blocks from the shared AST. Static values are emitted as JSON;
 * expression values are emitted through ExpressionDispatcher. Registry
 * metadata decides whether the generated source is sync or async.
 *
 * Block-yielding MAP iterators are handled by the materialiser — their compiled
 * code emits a lookup from `ctx.materialisedBlocks`. FILTER/FIND/MAP iterators
 * that yield non-block values are compiled inline as expressions.
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

import type { ASTNode, TemplateNodeId } from '../../../contracts/ast/ast.type'
import type {
  CompiledAncestorMetadataFunction,
  CompiledMaterialisedRenderBlockFunction,
  CompiledNestedRenderBlockFunction,
  CompiledRenderBlockFunction,
  CompiledStepMetadataFunction,
} from '../../../contracts/compiled/compiledFunctions.type'
import type {
  CompiledNestedRenderBlock,
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

  private readonly nestedBlockEntries = new Map<string, CompiledNestedRenderBlock>()

  private currentBlockHasChildren = false

  private currentBlockBaseDepth = 0

  private nestedBlockCounter = 0

  private compilingMaterialisedBlock = false

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
      compileStructuralIterate: (node, emitter, targetVar) =>
        this.tryCompileMaterialisedMapLookup(node, emitter, targetVar),
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
   * Intercepts MAP iterators whose yield template contains blocks. These are
   * handled by the materialiser — the compiled code reads the pre-rendered
   * blocks from `ctx.materialisedBlocks` instead of inline-rendering.
   */
  private tryCompileMaterialisedMapLookup(
    node: ASTNode | TemplateNode,
    emitter: CodeEmitter,
    targetVar: string,
  ): boolean {
    const properties = (node.properties ?? {}) as Record<string, unknown>
    const iterator = properties.iterator as Record<string, unknown> | undefined

    if (iterator?.type !== IteratorType.MAP || iterator.yieldTemplate === undefined) {
      return false
    }

    if (!this.yieldTemplateContainsBlocks(iterator.yieldTemplate)) {
      return false
    }

    emitter.assign(
      targetVar,
      `ctx.materialisedBlocks && ctx.materialisedBlocks.get(${JSON.stringify(String(node.id))}) || []`,
    )

    return true
  }

  private yieldTemplateContainsBlocks(template: unknown): boolean {
    if (template === null || template === undefined) {
      return false
    }

    if (this.isRenderBlockValue(template)) {
      return true
    }

    if (Array.isArray(template)) {
      return template.some(item => this.yieldTemplateContainsBlocks(item))
    }

    return false
  }

  /**
   * Gives render-specific nested blocks first chance at value compilation.
   * Every nested block is compiled as its own function and delegated via
   * evaluateChild — regardless of iterator depth.
   */
  private tryCompileRenderBlockValue(value: unknown, emitter: CodeEmitter, resultVar: string): boolean {
    if (this.expr.isTemplateNode(value)) {
      if (value.originalType !== ASTNodeType.BLOCK) {
        return false
      }

      this.emitNestedBlockDelegation(value, emitter, resultVar)

      return true
    }

    if (!this.isRenderBlockObject(value)) {
      return false
    }

    this.emitNestedBlockDelegation(value, emitter, resultVar)

    return true
  }

  /**
   * Compiles a nested block as a separate function, registers it in the plan,
   * and emits a delegating `await evaluateChild(childId)` in the parent. When
   * inside an inline iterator, passes the current scope frames so the runtime
   * can build the child's full scope stack.
   */
  private emitNestedBlockDelegation(
    block: TemplateNode | RenderBlockValue,
    emitter: CodeEmitter,
    resultVar: string,
  ): void {
    const inlineFrames = this.expr.iteratorStack.slice(this.currentBlockBaseDepth)

    const savedExprState = this.expr.saveState()
    const savedBaseDepth = this.currentBlockBaseDepth
    const childId = this.registerNestedBlock(block)
    this.expr.restoreState(savedExprState)
    this.currentBlockBaseDepth = savedBaseDepth

    if (inlineFrames.length > 0) {
      const frameExprs = inlineFrames.map(
        f =>
          `{ item: ${f.itemVar}, index: ${f.indexVar}, rawItem: ${f.rawItemExpr}, inputLength: ${f.inputLengthExpr} }`,
      )
      emitter.assign(resultVar, `await evaluateChild(${JSON.stringify(childId)}, [${frameExprs.join(', ')}])`)
    } else if (this.compilingMaterialisedBlock && this.currentBlockBaseDepth > 0) {
      emitter.assign(resultVar, `await evaluateChild(${JSON.stringify(childId)}, scopeStack)`)
    } else {
      emitter.assign(resultVar, `await evaluateChild(${JSON.stringify(childId)})`)
    }

    this.expr.markAsAsync()
    this.currentBlockHasChildren = true
  }

  /**
   * Compiles a nested block as its own function and registers it in the plan's
   * nested block map. Returns the child ID used to look it up at runtime.
   */
  private registerNestedBlock(block: TemplateNode | RenderBlockValue): string {
    const childId = block.id !== undefined ? String(block.id) : `nested_render_block:${this.nestedBlockCounter++}`
    const variant = String(block.variant ?? 'unknown')
    const iteratorDepth = this.expr.iteratorDepth

    const render = compileGeneratedFunction<CompiledNestedRenderBlockFunction>(
      this.expr,
      ['ctx', 'scopeStack', 'evaluateChild'],
      () => this.buildNestedBlockSource(block, iteratorDepth),
      { phase: 'render', forceAsync: true },
    )

    this.nestedBlockEntries.set(childId, { nodeId: childId as TemplateNodeId, variant, render })

    return childId
  }

  /**
   * Builds the JS source for a nested block function: pushes iterator frames
   * from scopeStack (when inside an iterator), evaluates properties, and
   * returns a branded RenderBlock.
   */
  private buildNestedBlockSource(block: TemplateNode | RenderBlockValue, iteratorDepth: number): string {
    this.currentBlockBaseDepth = iteratorDepth

    const emitter = CodeEmitter.strict()
    const blockType = block.blockType as string
    const properties = (block.properties ?? {}) as Record<string, unknown>
    const isTemplateBlock = this.expr.isTemplateNode(block)

    const emitBlockBody = (): void => {
      const propsVar = emitter.const('nestedBlockProps', '{}')

      for (const [key, value] of Object.entries(properties)) {
        if (StepRenderCompiler.BLOCK_SKIP_PROPS.has(key)) {
          continue
        }

        if (blockType === BlockType.FIELD && key === 'code') {
          this.fieldCodes.assignProperty(value, emitter, propsVar, key)

          continue
        }

        this.compilePropertyAssignment(value, emitter, propsVar, key)
      }

      if (blockType === BlockType.FIELD && properties.value === undefined) {
        this.compileFieldValueResolution(emitter, propsVar)
      }

      const idExpr =
        isTemplateBlock && blockType === BlockType.FIELD
          ? this.fieldCodes.compileIteratorFieldBlockIdExpression(`${propsVar}["code"]`, String(block.id))
          : JSON.stringify(block.id)

      emitter.return(
        `{
          [${GENERATED_FUNCTION_HELPERS_PARAM}.renderBlockBrand]: true,
          id: ${idExpr},
          variant: ${JSON.stringify(block.variant)},
          blockType: ${JSON.stringify(blockType)},
          properties: ${propsVar}
        }`,
      )
    }

    if (iteratorDepth > 0) {
      const pushFramesAndEmit = (level: number): void => {
        if (level < 0) {
          emitBlockBody()

          return
        }

        const frame: IteratorScopeFrame = {
          itemVar: `scopeStack[${level}].item`,
          indexVar: `scopeStack[${level}].index`,
          inputLengthExpr: `scopeStack[${level}].inputLength`,
          rawItemExpr: `scopeStack[${level}].rawItem`,
        }

        this.expr.withIteratorFrame(frame, () => pushFramesAndEmit(level - 1))
      }

      pushFramesAndEmit(iteratorDepth - 1)
    } else {
      emitBlockBody()
    }

    return emitter.toString()
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
   * functions, one CompiledRenderBlockFunction per top-level block, and nested
   * block functions for child blocks delegated via evaluateChild. Block-yielding
   * MAP iterators are handled by the materialiser — their compiled code emits a
   * lookup from `ctx.materialisedBlocks` instead of inline-rendering.
   */
  compileRenderPlan(
    stepNode: StepASTNode,
    ancestorNodes: JourneyASTNode[],
    materialisedNestedBlocks?: ReadonlyMap<string, CompiledNestedRenderBlock>,
  ): RenderPlan {
    this.nestedBlockEntries.clear()
    this.nestedBlockCounter = 0

    const compiledStepMetadata = this.compileStepMetadataFunction(stepNode)
    const compiledAncestorMetadata = this.compileAncestorMetadataFunction(ancestorNodes)

    const blocks: CompiledRenderBlock[] = (stepNode.properties.blocks ?? []).map(block => ({
      nodeId: block.id,
      variant: block.variant,
      render: this.compileBlock(block),
    }))

    const nestedBlocks = new Map(this.nestedBlockEntries)

    if (materialisedNestedBlocks) {
      materialisedNestedBlocks.forEach((entry, key) => nestedBlocks.set(key, entry))
    }

    return {
      compiledStepMetadata,
      compiledAncestorMetadata,
      renderBlocks: blocks,
      nestedBlocks,
    }
  }

  /**
   * Compiles materialised render functions for the given iterate nodes. Returns
   * a map keyed by TemplateNodeId containing the compiled render function and
   * metadata for each template block found in the iterate nodes' yield templates,
   * plus nested blocks accumulated during compilation (needed at render time when
   * a materialised block delegates to evaluateChild).
   */
  compileMaterialisedRenderFunctions(iterateNodes: IterateASTNode[]): {
    entries: Map<
      TemplateNodeId,
      { nodeId: TemplateNodeId; variant: string; render: CompiledMaterialisedRenderBlockFunction }
    >
    nestedBlocks: ReadonlyMap<string, CompiledNestedRenderBlock>
  } {
    this.nestedBlockEntries.clear()
    this.nestedBlockCounter = 0

    const entries = new Map<
      TemplateNodeId,
      { nodeId: TemplateNodeId; variant: string; render: CompiledMaterialisedRenderBlockFunction }
    >()

    for (const iterateNode of iterateNodes) {
      if (iterateNode.properties.iterator.type !== IteratorType.MAP) {
        continue
      }

      const template = iterateNode.properties.iterator.yieldTemplate

      if (template === undefined) {
        continue
      }

      this.collectMaterialisedRenderBlocks(template, entries, 1)
    }

    return { entries, nestedBlocks: new Map(this.nestedBlockEntries) }
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
    this.currentBlockHasChildren = false

    return compileGeneratedFunction<CompiledRenderBlockFunction>(
      this.expr,
      ['ctx', 'evaluateChild'],
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
    this.currentBlockBaseDepth = 0

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

  private collectMaterialisedRenderBlocks(
    template: TemplateValue,
    entries: Map<
      TemplateNodeId,
      { nodeId: TemplateNodeId; variant: string; render: CompiledMaterialisedRenderBlockFunction }
    >,
    depth: number,
  ): void {
    const directNodes = this.templates.findTemplateNodes(
      template,
      node => isTemplateBlockNode(node) || isTemplateIterateNode(node),
      { descendIntoMatches: false },
    )

    directNodes.forEach(node => {
      if (isTemplateBlockNode(node)) {
        entries.set(node.id as TemplateNodeId, {
          nodeId: node.id as TemplateNodeId,
          variant: node.variant as string,
          render: this.compileMaterialisedRenderBlock(node, depth),
        })

        return
      }

      const yieldTemplate = this.templates.getMapIterateYieldTemplate(node)

      if (yieldTemplate !== undefined) {
        this.collectMaterialisedRenderBlocks(yieldTemplate, entries, depth + 1)
      }
    })
  }

  private compileMaterialisedRenderBlock(
    block: TemplateNode,
    nestingDepth: number,
  ): CompiledMaterialisedRenderBlockFunction {
    this.currentBlockHasChildren = false

    return compileGeneratedFunction<CompiledMaterialisedRenderBlockFunction>(
      this.expr,
      ['ctx', 'scopeStack', 'evaluateChild'],
      () => this.buildMaterialisedRenderBlockSource(block, nestingDepth),
      { phase: 'render' },
    )
  }

  private buildMaterialisedRenderBlockSource(block: TemplateNode, nestingDepth: number): string {
    this.currentBlockBaseDepth = nestingDepth
    this.compilingMaterialisedBlock = true

    const emitter = CodeEmitter.strict()

    const pushFramesAndEmit = (level: number): void => {
      if (level < 0) {
        this.emitRenderBlock(block, emitter, true)

        return
      }

      const frame: IteratorScopeFrame = {
        itemVar: `scopeStack[${level}].item`,
        indexVar: `scopeStack[${level}].index`,
        inputLengthExpr: `scopeStack[${level}].inputLength`,
        rawItemExpr: `scopeStack[${level}].rawItem`,
      }

      this.expr.withIteratorFrame(frame, () => pushFramesAndEmit(level - 1))
    }

    pushFramesAndEmit(nestingDepth - 1)
    this.compilingMaterialisedBlock = false

    return emitter.toString()
  }
}
