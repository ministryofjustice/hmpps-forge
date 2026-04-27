/**
 * Compiles render context evaluation for one step.
 *
 * The generated function builds evaluated step metadata, journey ancestor
 * metadata, and blocks from the shared AST. Static values are emitted as JSON;
 * expression values are emitted through NodeCompilationDispatcher. Registry
 * metadata decides whether the generated source is sync or async.
 *
 * MAP iterators that yield blocks are emitted as loops that push blocks directly
 * into the render result. FILTER/FIND/MAP iterators used as property values are
 * compiled inline as expressions. No runtime node expansion is required.
 */
import { NodeId } from '../../types/ast.type'
import { ASTNodeType } from '../../types/enums'
import { BlockType, IteratorType } from '../../../authoring/types/enums'
import { BlockASTNode, JourneyASTNode, StepASTNode } from '../../types/structures.type'
import { IterateASTNode } from '../../types/expressions.type'
import { TemplateNode, TemplateValue } from '../../types/template.type'
import FunctionRegistry from '../../registries/FunctionRegistry'
import CodeEmitter from '../codegen/CodeEmitter'
import NodeCompilationDispatcher from '../codegen/NodeCompilationDispatcher'
import { buildGeneratedSource, compileGeneratedFunction } from '../codegen/GeneratedFunctionCompiler'
import ScopedTemplateCompiler, { isTemplateBlockNode } from '../codegen/ScopedTemplateCompiler'
import RuntimeValueCompiler from '../codegen/RuntimeValueCompiler'

/**
 * Runtime context passed to the compiled render function.
 * Field value resolution reads the AnswerHistory produced by compiled answer
 * preparation, including parsed values and mutation sources.
 */
export interface RenderCompilationContext {
  answers: Record<string, { current: unknown; parsed?: unknown; mutations?: { source: string; value: unknown }[] }>
  data: Record<string, unknown>
  session: Record<string, unknown>
  params: Record<string, unknown>
  query: Record<string, unknown>
  request: Record<string, unknown>
  conditions: FunctionRegistry
}

/** Single evaluated block in the compiled render output. */
export interface CompiledBlock {
  id: NodeId
  type: ASTNodeType.BLOCK
  variant: string
  blockType: BlockType
  properties: Record<string, unknown>
}

/** Output of the compiled render function — blocks + step/ancestor metadata. */
export interface CompiledRenderResult {
  blocks: CompiledBlock[]
  step: Record<string, unknown>
  ancestors: Record<string, unknown>[]
}

type SyncCompiledRenderFunction = (ctx: RenderCompilationContext) => CompiledRenderResult

export type CompiledRenderFunction = (
  ctx: RenderCompilationContext,
) => CompiledRenderResult | Promise<CompiledRenderResult>

interface RenderBlockValue {
  readonly id?: unknown
  readonly type: ASTNodeType.BLOCK
  readonly variant: string
  readonly blockType: string
  readonly properties?: Record<string, unknown>
}

export default class StepRenderCompiler {
  // These properties affect answer prep or validation, not rendered block props.
  private static readonly BLOCK_SKIP_PROPS = new Set(['formatters', 'parsers', 'validWhen', 'dependentWhen'])

  // Hooks, blocks, and reachability are executable structure, not render metadata.
  private static readonly STEP_SKIP_PROPS = new Set(['onAccess', 'onSubmission', 'blocks', 'reachability'])

  // Child structure and access hooks are route/lifecycle concerns, not metadata.
  private static readonly JOURNEY_SKIP_PROPS = new Set(['onAccess', 'children', 'steps', 'reachability'])

  private readonly expr = new NodeCompilationDispatcher()

  private readonly templates = new ScopedTemplateCompiler(this.expr)

  private readonly values = new RuntimeValueCompiler(this.expr, {
    expressionErrorFallback: 'undefined',
    omitUndefinedArrayItems: true,
    isStructuralValue: value => this.isRenderBlockValue(value),
    compileStructuralValue: (value, emitter, targetVar) => this.compileRenderBlockValue(value, emitter, targetVar),
    noteInlineIterator: nodeId => {
      this.inlineIterateIds.add(nodeId)
    },
  })

  // Iterates used as property values are compiled at that property site. Track
  // them so block-yielding MAP iterators are not emitted a second time as
  // top-level blocks.
  private readonly inlineIterateIds = new Set<string>()

  compile(
    stepNode: StepASTNode,
    ancestorNodes: JourneyASTNode[],
    iterateNodes?: IterateASTNode[],
  ): SyncCompiledRenderFunction | undefined

  compile(
    stepNode: StepASTNode,
    ancestorNodes: JourneyASTNode[],
    iterateNodes: IterateASTNode[],
    functionRegistry: FunctionRegistry,
  ): CompiledRenderFunction | undefined

  compile(
    stepNode: StepASTNode,
    ancestorNodes: JourneyASTNode[],
    iterateNodes: IterateASTNode[] = [],
    functionRegistry?: FunctionRegistry,
  ): CompiledRenderFunction | SyncCompiledRenderFunction | undefined {
    return compileGeneratedFunction<CompiledRenderFunction>(this.expr, ['ctx'], functionRegistry, () =>
      this.buildSource(stepNode, ancestorNodes, iterateNodes),
    )
  }

  generateSource(
    stepNode: StepASTNode,
    ancestorNodes: JourneyASTNode[],
    iterateNodes: IterateASTNode[] = [],
    functionRegistry?: FunctionRegistry,
  ): string {
    return buildGeneratedSource(this.expr, functionRegistry, () =>
      this.buildSource(stepNode, ancestorNodes, iterateNodes),
    )
  }

  private buildSource(stepNode: StepASTNode, ancestorNodes: JourneyASTNode[], iterateNodes: IterateASTNode[]): string {
    this.inlineIterateIds.clear()
    const emitter = new CodeEmitter()

    emitter.emit('"use strict";')
    emitter.emit('var blocks = [];')
    emitter.emit('var step = {};')
    emitter.emit('var ancestors = [];')
    emitter.emitBlank()

    this.compileStepMetadata(stepNode, emitter)
    emitter.emitBlank()

    this.compileAncestorMetadata(ancestorNodes, emitter)
    emitter.emitBlank()

    this.compileBlocks(stepNode.properties.blocks ?? [], emitter)
    emitter.emitBlank()

    this.compileIterateBlocks(iterateNodes, emitter)

    emitter.emit('return { blocks: blocks, step: step, ancestors: ancestors };')

    return emitter.toString()
  }

  private compileStepMetadata(stepNode: StepASTNode, emitter: CodeEmitter): void {
    for (const [key, value] of Object.entries(stepNode.properties)) {
      if (StepRenderCompiler.STEP_SKIP_PROPS.has(key)) {
        continue
      }

      this.compilePropertyAssignment(value, emitter, 'step', key)
    }
  }

  private compileAncestorMetadata(ancestorNodes: JourneyASTNode[], emitter: CodeEmitter): void {
    if (ancestorNodes.length === 0) {
      return
    }

    emitter.emit('var _composedPath = "";')

    for (let i = 0; i < ancestorNodes.length; i++) {
      const ancestor = ancestorNodes[i]
      const ancVar = emitter.nextVar('_anc')

      emitter.emit(`var ${ancVar} = {};`)

      for (const [key, value] of Object.entries(ancestor.properties)) {
        if (StepRenderCompiler.JOURNEY_SKIP_PROPS.has(key)) {
          continue
        }

        this.compilePropertyAssignment(value, emitter, ancVar, key)
      }

      emitter.emit(
        `_composedPath = "/" + (_composedPath + "/" + ${ancVar}["path"]).split("/").filter(Boolean).join("/");`,
      )
      emitter.emit(`${ancVar}["path"] = _composedPath;`)
      emitter.emit(`ancestors.push(${ancVar});`)
      emitter.emitBlank()
    }
  }

  private compileBlocks(blocks: BlockASTNode[], emitter: CodeEmitter): void {
    for (const block of blocks) {
      this.compileBlock(block, emitter, 'blocks')
      emitter.emitBlank()
    }
  }

  /** Emits one registered block into the render output. */
  private compileBlock(block: BlockASTNode, emitter: CodeEmitter, targetArrayVar: string): void {
    const propsVar = emitter.nextVar('_props')

    emitter.emit(`var ${propsVar} = {};`)

    for (const [key, value] of Object.entries(block.properties)) {
      if (StepRenderCompiler.BLOCK_SKIP_PROPS.has(key)) {
        continue
      }

      this.compilePropertyAssignment(value, emitter, propsVar, key)
    }

    if (block.blockType === BlockType.FIELD && block.properties.value === undefined) {
      this.compileFieldValueResolution(emitter, propsVar)
    }

    emitter.emit(
      `${targetArrayVar}.push({ id: ${JSON.stringify(block.id)}, type: ${JSON.stringify(ASTNodeType.BLOCK)}, variant: ${JSON.stringify(block.variant)}, blockType: ${JSON.stringify(block.blockType)}, properties: ${propsVar} });`,
    )
  }

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

  /** Emits a for loop over the iterator input, compiling each template block per item. */
  private compileMapIteratorBlocks(
    iterateNode: IterateASTNode,
    templateBlocks: TemplateNode[],
    emitter: CodeEmitter,
  ): void {
    this.templates.compileMapIterator(iterateNode, emitter, () => {
      templateBlocks.forEach(templateBlock => {
        const codeExpr = this.templates.compileTemplateCodeExpression(templateBlock, emitter)

        this.compileTemplateBlock(templateBlock, codeExpr, emitter)
      })
    })
  }

  /**
   * Compiles a single template block inside an iterator loop. Uses "compiled:" + fieldCode
   * as the block ID — this deterministic scheme lets the validation compiler's failures
   * (which also use blockCode) match up in RenderContextFactory.attachValidationToBlocks().
   */
  private compileTemplateBlock(block: TemplateNode, codeExpr: string | undefined, emitter: CodeEmitter): void {
    const propsVar = emitter.nextVar('_tprops')
    const blockType = block.blockType

    emitter.emit(`var ${propsVar} = {};`)

    const properties = block.properties ?? {}

    for (const [key, value] of Object.entries(properties)) {
      if (StepRenderCompiler.BLOCK_SKIP_PROPS.has(key)) {
        continue
      }

      this.compilePropertyAssignment(value, emitter, propsVar, key)
    }

    if (blockType === BlockType.FIELD && properties.value === undefined) {
      this.compileFieldValueResolution(emitter, propsVar)
    }

    const idExpr =
      blockType === BlockType.FIELD && codeExpr !== undefined
        ? `"compiled:" + ${codeExpr}`
        : JSON.stringify(`compiled:${String(block.id)}`)

    emitter.emit(
      `blocks.push({ id: ${idExpr}, type: ${JSON.stringify(ASTNodeType.BLOCK)}, variant: ${JSON.stringify(block.variant)}, blockType: ${JSON.stringify(blockType)}, properties: ${propsVar} });`,
    )
  }

  private compileFieldValueResolution(emitter: CodeEmitter, propsVar: string): void {
    const codeVar = emitter.nextVar('_fcode')
    const histVar = emitter.nextVar('_fhist')

    emitter.emit(`var ${codeVar} = ${propsVar}["code"];`)
    emitter.emitBlock(`if (typeof ${codeVar} === "string")`, () => {
      emitter.emit(`var ${histVar} = ctx.answers[${codeVar}];`)

      emitter.emitBlock('if (ctx.request.method === "POST")', () => {
        const mutsVar = emitter.nextVar('_fmuts')
        const postIndexVar = emitter.nextVar('_fpostIndex')
        const usePostVar = emitter.nextVar('_fusePost')
        const iVar = emitter.nextVar('_fi')
        const laterVar = emitter.nextVar('_flater')

        emitter.emit(`var ${mutsVar} = ${histVar} && ${histVar}.mutations ? ${histVar}.mutations : [];`)
        emitter.emit(`var ${postIndexVar} = -1;`)
        emitter.emitBlock(`for (var ${iVar} = ${mutsVar}.length - 1; ${iVar} >= 0; ${iVar}--)`, () => {
          emitter.emitBlock(`if (${mutsVar}[${iVar}].source === "post")`, () => {
            emitter.emit(`${postIndexVar} = ${iVar}; break;`)
          })
        })
        emitter.emit(`var ${usePostVar} = ${postIndexVar} >= 0;`)
        emitter.emitBlock(`if (${usePostVar})`, () => {
          emitter.emitBlock(
            `for (var ${laterVar} = ${postIndexVar} + 1; ${laterVar} < ${mutsVar}.length; ${laterVar}++)`,
            () => {
              emitter.emitBlock(`if (${mutsVar}[${laterVar}].source !== "processed")`, () => {
                emitter.emit(`${usePostVar} = false; break;`)
              })
            },
          )
        })
        emitter.emit(
          `${propsVar}["value"] = ${usePostVar} ? ${mutsVar}[${postIndexVar}].value : (${histVar} ? ${histVar}.current : undefined);`,
        )
      })
      emitter.emitBlock('else', () => {
        emitter.emit(
          `${propsVar}["value"] = ${histVar} ? (${histVar}.parsed !== undefined ? ${histVar}.parsed : ${histVar}.current) : ${propsVar}["defaultValue"];`,
        )
      })
    })
  }

  private compilePropertyAssignment(value: unknown, emitter: CodeEmitter, targetObj: string, key: string): void {
    this.values.compileAssignment(value, emitter, targetObj, key)
  }

  /** Compiles a block nested inside another block's properties (e.g. radio conditional reveals). */
  private compileRenderBlockValue(value: unknown, emitter: CodeEmitter, resultVar: string): boolean {
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

  private compileNestedBlock(block: RenderBlockValue, emitter: CodeEmitter, resultVar: string): void {
    const propsVar = emitter.nextVar('_nprops')
    const properties = block.properties ?? {}
    const blockType = block.blockType

    emitter.emit(`var ${propsVar} = {};`)

    Object.entries(properties).forEach(([key, value]) => {
      if (StepRenderCompiler.BLOCK_SKIP_PROPS.has(key)) {
        return
      }

      this.compilePropertyAssignment(value, emitter, propsVar, key)
    })

    if (blockType === BlockType.FIELD && properties.value === undefined) {
      this.compileFieldValueResolution(emitter, propsVar)
    }

    emitter.emit(
      `${resultVar} = { id: ${JSON.stringify(block.id)}, type: ${JSON.stringify(ASTNodeType.BLOCK)}, variant: ${JSON.stringify(block.variant)}, blockType: ${JSON.stringify(blockType)}, properties: ${propsVar} };`,
    )
  }

  /** Compiles a template node that represents a nested block inside an iterator yield. */
  private compileTemplateNestedBlock(block: TemplateNode, emitter: CodeEmitter, resultVar: string): void {
    const propsVar = emitter.nextVar('_tnprops')
    const blockType = block.blockType

    emitter.emit(`var ${propsVar} = {};`)

    const properties = block.properties ?? {}

    Object.entries(properties).forEach(([key, value]) => {
      if (StepRenderCompiler.BLOCK_SKIP_PROPS.has(key)) {
        return
      }

      this.compilePropertyAssignment(value, emitter, propsVar, key)
    })

    if (blockType === BlockType.FIELD && properties.value === undefined) {
      this.compileFieldValueResolution(emitter, propsVar)
    }

    // FIELD blocks inside iterators use "compiled:" + fieldCode as their ID so
    // validation failures (which are remapped to the same scheme) can match.
    // The code property has already been compiled into propsVar at this point.
    const idExpr = blockType === BlockType.FIELD ? `"compiled:" + ${propsVar}["code"]` : JSON.stringify(block.id)

    emitter.emit(
      `${resultVar} = { id: ${idExpr}, type: ${JSON.stringify(ASTNodeType.BLOCK)}, variant: ${JSON.stringify(block.variant)}, blockType: ${JSON.stringify(blockType)}, properties: ${propsVar} };`,
    )
  }

  private isRenderBlockValue(value: unknown): boolean {
    if (this.expr.isTemplateNode(value)) {
      return value.originalType === ASTNodeType.BLOCK
    }

    return this.isRenderBlockObject(value)
  }

  private isRenderBlockObject(value: unknown): value is RenderBlockValue {
    if (value === null || value === undefined || typeof value !== 'object') {
      return false
    }

    const obj = value as Record<string, unknown>

    return obj.type === ASTNodeType.BLOCK && typeof obj.variant === 'string' && typeof obj.blockType === 'string'
  }

  /** Yield templates can nest blocks below arrays or objects, so render scans before emitting loops. */
  private findTemplateBlocks(template: TemplateValue): TemplateNode[] {
    return this.templates.findTemplateNodes(template, isTemplateBlockNode, { descendIntoMatches: false })
  }
}
