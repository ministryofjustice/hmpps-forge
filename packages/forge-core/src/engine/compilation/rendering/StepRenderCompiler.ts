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
import { ASTNode, NodeId } from '../../types/ast.type'
import { ASTNodeType } from '../../types/enums'
import { BlockType, ExpressionType, IteratorType } from '../../../authoring/types/enums'
import { BlockASTNode, JourneyASTNode, StepASTNode } from '../../types/structures.type'
import { ConditionalASTNode, IterateASTNode, MatchASTNode } from '../../types/expressions.type'
import { TemplateNode, TemplateValue } from '../../types/template.type'
import FunctionRegistry from '../../registries/FunctionRegistry'
import CodeEmitter from '../codegen/CodeEmitter'
import NodeCompilationDispatcher, { IteratorScopeFrame } from '../codegen/NodeCompilationDispatcher'
import { buildGeneratedSource, compileGeneratedFunction } from '../codegen/GeneratedFunctionCompiler'
import { emitIteratorItemScope, emitNormalizeIteratorInput } from '../codegen/iteratorCodegen'

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
  scope: Record<string, unknown>[]
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

export default class StepRenderCompiler {
  private readonly expr = new NodeCompilationDispatcher()

  // Iterates used as property values are compiled at that property site. Track
  // them so block-yielding MAP iterators are not emitted a second time as
  // top-level blocks.
  private readonly inlineIterateIds = new Set<string>()

  // These properties affect answer prep or validation, not rendered block props.
  private static readonly BLOCK_SKIP_PROPS = new Set(['formatters', 'parsers', 'validWhen', 'dependentWhen'])

  // Hooks, blocks, and reachability are executable structure, not render metadata.
  private static readonly STEP_SKIP_PROPS = new Set(['onAccess', 'onAction', 'onSubmission', 'blocks', 'reachability'])

  // Child structure and access hooks are route/lifecycle concerns, not metadata.
  private static readonly JOURNEY_SKIP_PROPS = new Set(['onAccess', 'children', 'steps', 'reachability'])

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

        for (const templateBlock of templateBlocks) {
          const codeVar = this.compileTemplateBlockCode(templateBlock, indexVar, itemVar, emitter)
          const frame: IteratorScopeFrame = { itemVar, indexVar, codeVar }

          this.expr.pushIteratorFrame(frame)
          this.compileTemplateBlock(templateBlock, codeVar, emitter)
          this.expr.popIteratorFrame()
        }
      })
    })
  }

  /**
   * Compiles the field code for a template block. Static string codes return undefined
   * (the code is inlined as a property). Dynamic codes (template expressions like
   * Format("person_%1", Item().index())) return the JS variable name holding the
   * computed code at runtime.
   */
  private compileTemplateBlockCode(
    block: TemplateNode,
    indexVar: string,
    itemVar: string,
    emitter: CodeEmitter,
  ): string | undefined {
    const code = block.properties?.code

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

  /**
   * Compiles a single template block inside an iterator loop. Uses "compiled:" + fieldCode
   * as the block ID — this deterministic scheme lets the validation compiler's failures
   * (which also use blockCode) match up in RenderContextFactory.attachValidationToBlocks().
   */
  private compileTemplateBlock(block: TemplateNode, codeVar: string | undefined, emitter: CodeEmitter): void {
    const propsVar = emitter.nextVar('_tprops')
    const blockType = block.blockType as string

    emitter.emit(`var ${propsVar} = {};`)

    const properties = block.properties ?? {}

    for (const [key, value] of Object.entries(properties)) {
      if (StepRenderCompiler.BLOCK_SKIP_PROPS.has(key)) {
        continue
      }

      this.compileTemplatePropertyAssignment(value, emitter, propsVar, key)
    }

    if (blockType === BlockType.FIELD && properties.value === undefined) {
      this.compileFieldValueResolution(emitter, propsVar)
    }

    const idExpr = codeVar ? `"compiled:" + ${codeVar}` : JSON.stringify(`compiled:${String(block.id)}`)

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

  /** Assigns a compiled property value to a target object key. */
  private compilePropertyAssignment(value: unknown, emitter: CodeEmitter, targetObj: string, key: string): void {
    if (this.isStaticValue(value)) {
      emitter.emit(`${targetObj}[${JSON.stringify(key)}] = ${JSON.stringify(value)};`)

      return
    }

    const resultVar = emitter.nextVar('_v')

    emitter.emit(`var ${resultVar};`)
    this.compilePropertyValue(value, emitter, resultVar)
    emitter.emit(`${targetObj}[${JSON.stringify(key)}] = ${resultVar};`)
  }

  /** Recursive property compilation — dispatches on value type. */
  private compilePropertyValue(value: unknown, emitter: CodeEmitter, resultVar: string): void {
    if (value === null || value === undefined) {
      emitter.emit(`${resultVar} = ${JSON.stringify(value)};`)

      return
    }

    if (this.expr.isCompilableNode(value)) {
      this.compileASTNodeValue(value as ASTNode, emitter, resultVar)

      return
    }

    if (this.expr.isTemplateNode(value)) {
      this.compileExpressionWithCatch(this.expr.compileTemplateExpression(value as TemplateNode), emitter, resultVar)

      return
    }

    if (Array.isArray(value)) {
      this.compileArrayValue(value, emitter, resultVar)

      return
    }

    if (typeof value === 'object') {
      if (this.isBlockNode(value)) {
        this.compileNestedBlock(value as BlockASTNode, emitter, resultVar)

        return
      }

      this.compileObjectValue(value as Record<string, unknown>, emitter, resultVar)

      return
    }

    emitter.emit(`${resultVar} = ${JSON.stringify(value)};`)
  }

  /**
   * Handles AST nodes that need statement-level compilation (CONDITIONAL, MATCH,
   * ITERATE, nested blocks). Other expression types delegate to the shared node
   * dispatcher for inline compilation wrapped in try/catch.
   */
  private compileASTNodeValue(node: ASTNode, emitter: CodeEmitter, resultVar: string): void {
    if (node.type === ASTNodeType.EXPRESSION) {
      const exprNode = node as { expressionType?: string }

      if (exprNode.expressionType === ExpressionType.CONDITIONAL) {
        this.compileConditionalStatement(node as ConditionalASTNode, emitter, resultVar)

        return
      }

      if (exprNode.expressionType === ExpressionType.MATCH) {
        this.compileMatchStatement(node as MatchASTNode, emitter, resultVar)

        return
      }

      if (exprNode.expressionType === ExpressionType.ITERATE) {
        this.inlineIterateIds.add(node.id)
        this.compileIterateExpression(node as IterateASTNode, emitter, resultVar)

        return
      }
    }

    if (node.type === ASTNodeType.BLOCK) {
      this.compileNestedBlock(node as BlockASTNode, emitter, resultVar)

      return
    }

    this.compileExpressionWithCatch(this.expr.compileExpression(node), emitter, resultVar)
  }

  /** Wraps optional render expressions so one bad property resolves to undefined. */
  private compileExpressionWithCatch(exprStr: string, emitter: CodeEmitter, resultVar: string): void {
    emitter.emitBlock('try', () => {
      emitter.emit(`${resultVar} = ${exprStr};`)
    })
    emitter.emitBlock('catch(e)', () => {
      emitter.emit(`${resultVar} = undefined;`)
    })
  }

  /** Compiles an array — each element compiled individually, undefined results filtered out. */
  private compileArrayValue(value: unknown[], emitter: CodeEmitter, resultVar: string): void {
    const arrVar = emitter.nextVar('_arr')

    emitter.emit(`var ${arrVar} = [];`)

    for (const element of value) {
      if (this.isStaticValue(element)) {
        emitter.emit(`${arrVar}.push(${JSON.stringify(element)});`)

        continue
      }

      const elemVar = emitter.nextVar('_elem')

      emitter.emit(`var ${elemVar};`)
      this.compilePropertyValue(element, emitter, elemVar)
      emitter.emitBlock(`if (${elemVar} !== undefined)`, () => {
        emitter.emit(`${arrVar}.push(${elemVar});`)
      })
    }

    emitter.emit(`${resultVar} = ${arrVar};`)
  }

  private compileObjectValue(obj: Record<string, unknown>, emitter: CodeEmitter, resultVar: string): void {
    const objVar = emitter.nextVar('_obj')

    emitter.emit(`var ${objVar} = {};`)

    for (const [key, val] of Object.entries(obj)) {
      this.compilePropertyAssignment(val, emitter, objVar, key)
    }

    emitter.emit(`${resultVar} = ${objVar};`)
  }

  /** Compiles a block nested inside another block's properties (e.g. radio conditional reveals). */
  private compileNestedBlock(block: BlockASTNode, emitter: CodeEmitter, resultVar: string): void {
    const propsVar = emitter.nextVar('_nprops')

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
      `${resultVar} = { id: ${JSON.stringify(block.id)}, type: ${JSON.stringify(ASTNodeType.BLOCK)}, variant: ${JSON.stringify(block.variant)}, blockType: ${JSON.stringify(block.blockType)}, properties: ${propsVar} };`,
    )
  }

  /**
   * Render conditionals sometimes return whole block-property objects. Statement
   * emission lets each branch recurse through property compilation before the
   * selected value is assigned.
   */
  private compileConditionalStatement(node: ConditionalASTNode, emitter: CodeEmitter, resultVar: string): void {
    const predVar = emitter.nextVar('_pred')

    emitter.emit(`var ${predVar};`)
    this.compileExpressionWithCatch(this.expr.compileExpression(node.properties.predicate), emitter, predVar)

    emitter.emitBlock(`if (${predVar})`, () => {
      if (this.isStaticValue(node.properties.thenValue)) {
        emitter.emit(`${resultVar} = ${JSON.stringify(node.properties.thenValue)};`)
      } else {
        this.compilePropertyValue(node.properties.thenValue, emitter, resultVar)
      }
    })
    emitter.emitBlock('else', () => {
      if (this.isStaticValue(node.properties.elseValue)) {
        emitter.emit(`${resultVar} = ${JSON.stringify(node.properties.elseValue)};`)
      } else {
        this.compilePropertyValue(node.properties.elseValue, emitter, resultVar)
      }
    })
  }

  /**
   * MATCH preserves authoring order because later branch predicates may only be
   * meaningful when earlier predicates did not match.
   */
  private compileMatchStatement(node: MatchASTNode, emitter: CodeEmitter, resultVar: string): void {
    const branches = node.properties.branches
    const predicateVars = branches.map(() => emitter.nextVar('_mpred'))

    for (let i = 0; i < branches.length; i++) {
      const branch = branches[i]
      const predVar = predicateVars[i]

      emitter.emit(`var ${predVar};`)
      this.compileExpressionWithCatch(this.expr.compileExpression(branch.predicate), emitter, predVar)
    }

    for (let i = 0; i < branches.length; i++) {
      const branch = branches[i]
      const predVar = predicateVars[i]
      const keyword = i === 0 ? `if (${predVar})` : `else if (${predVar})`

      emitter.emitBlock(keyword, () => {
        if (this.isStaticValue(branch.value)) {
          emitter.emit(`${resultVar} = ${JSON.stringify(branch.value)};`)
        } else {
          this.compilePropertyValue(branch.value, emitter, resultVar)
        }
      })
    }

    if (node.properties.otherwise !== undefined) {
      if (branches.length === 0) {
        if (this.isStaticValue(node.properties.otherwise)) {
          emitter.emit(`${resultVar} = ${JSON.stringify(node.properties.otherwise)};`)
        } else {
          this.compilePropertyValue(node.properties.otherwise, emitter, resultVar)
        }
      } else {
        emitter.emitBlock('else', () => {
          if (this.isStaticValue(node.properties.otherwise)) {
            emitter.emit(`${resultVar} = ${JSON.stringify(node.properties.otherwise)};`)
          } else {
            this.compilePropertyValue(node.properties.otherwise, emitter, resultVar)
          }
        })
      }
    }
  }

  /**
   * Property-level iterators compile inline so dynamic options and conditional
   * values share the same @item/@scope semantics as block-yielding MAP iterators.
   */
  private compileIterateExpression(node: IterateASTNode, emitter: CodeEmitter, resultVar: string): void {
    const iterType = node.properties.iterator.type

    if (iterType === IteratorType.MAP) {
      this.compileMapExpression(node, emitter, resultVar)
    } else if (iterType === IteratorType.FILTER) {
      this.compileFilterExpression(node, emitter, resultVar)
    } else if (iterType === IteratorType.FIND) {
      this.compileFindExpression(node, emitter, resultVar)
    } else {
      emitter.emit(`${resultVar} = undefined;`)
    }
  }

  private compileMapExpression(node: IterateASTNode, emitter: CodeEmitter, resultVar: string): void {
    const inputExpr = this.expr.compileOperand(node.properties.input)
    const inputVar = emitter.nextVar('_input')
    const indexVar = emitter.nextVar('_idx')
    const itemVar = emitter.nextVar('_item')
    const arrVar = emitter.nextVar('_marr')

    emitter.emit(`var ${inputVar} = ${inputExpr};`)
    emitNormalizeIteratorInput(emitter, inputVar)
    emitter.emit(`var ${arrVar} = [];`)

    emitter.emitBlock(`if (Array.isArray(${inputVar}))`, () => {
      emitter.emitBlock(`for (var ${indexVar} = 0; ${indexVar} < ${inputVar}.length; ${indexVar}++)`, () => {
        emitter.emitBlock(`if (${inputVar}[${indexVar}] == null)`, () => {
          emitter.emit('continue;')
        })
        emitIteratorItemScope(emitter, inputVar, indexVar, itemVar)

        const yieldTemplate = node.properties.iterator.yieldTemplate
        const frame: IteratorScopeFrame = { itemVar, indexVar }

        this.expr.pushIteratorFrame(frame)

        const yieldVar = emitter.nextVar('_yield')

        emitter.emit(`var ${yieldVar};`)
        this.compileTemplatePropertyValue(yieldTemplate, emitter, yieldVar)
        emitter.emitBlock(`if (${yieldVar} !== undefined)`, () => {
          emitter.emit(`${arrVar}.push(${yieldVar});`)
        })

        this.expr.popIteratorFrame()
      })
    })

    emitter.emit(`${resultVar} = ${arrVar};`)
  }

  private compileFilterExpression(node: IterateASTNode, emitter: CodeEmitter, resultVar: string): void {
    const inputExpr = this.expr.compileOperand(node.properties.input)
    const inputVar = emitter.nextVar('_input')
    const indexVar = emitter.nextVar('_idx')
    const itemVar = emitter.nextVar('_item')
    const arrVar = emitter.nextVar('_farr')

    emitter.emit(`var ${inputVar} = ${inputExpr};`)
    emitNormalizeIteratorInput(emitter, inputVar)
    emitter.emit(`var ${arrVar} = [];`)

    emitter.emitBlock(`if (Array.isArray(${inputVar}))`, () => {
      emitter.emitBlock(`for (var ${indexVar} = 0; ${indexVar} < ${inputVar}.length; ${indexVar}++)`, () => {
        emitter.emitBlock(`if (${inputVar}[${indexVar}] == null)`, () => {
          emitter.emit('continue;')
        })
        emitIteratorItemScope(emitter, inputVar, indexVar, itemVar)

        const predTemplate = node.properties.iterator.predicateTemplate
        const frame: IteratorScopeFrame = { itemVar, indexVar }

        this.expr.pushIteratorFrame(frame)

        const predVar = emitter.nextVar('_fpred')

        emitter.emit(`var ${predVar};`)
        emitter.emitBlock('try', () => {
          emitter.emit(`${predVar} = ${this.expr.compileOperand(predTemplate)};`)
        })
        emitter.emitBlock('catch(e)', () => {
          emitter.emit(`${predVar} = false;`)
        })
        emitter.emitBlock(`if (${predVar})`, () => {
          emitter.emit(`${arrVar}.push(${inputVar}[${indexVar}]);`)
        })

        this.expr.popIteratorFrame()
      })
    })

    emitter.emit(`${resultVar} = ${arrVar};`)
  }

  private compileFindExpression(node: IterateASTNode, emitter: CodeEmitter, resultVar: string): void {
    const inputExpr = this.expr.compileOperand(node.properties.input)
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

        const predTemplate = node.properties.iterator.predicateTemplate
        const frame: IteratorScopeFrame = { itemVar, indexVar }

        this.expr.pushIteratorFrame(frame)

        const predVar = emitter.nextVar('_fpred')

        emitter.emit(`var ${predVar};`)
        emitter.emitBlock('try', () => {
          emitter.emit(`${predVar} = ${this.expr.compileOperand(predTemplate)};`)
        })
        emitter.emitBlock('catch(e)', () => {
          emitter.emit(`${predVar} = false;`)
        })
        emitter.emitBlock(`if (${predVar})`, () => {
          emitter.emit(`${resultVar} = ${inputVar}[${indexVar}]; break;`)
        })

        this.expr.popIteratorFrame()
      })
    })
  }

  /**
   * Template nodes keep their authored shape inside yieldTemplate. They resolve
   * through the active iterator scope instead of being registered as AST nodes.
   */
  private compileTemplatePropertyAssignment(
    value: TemplateValue,
    emitter: CodeEmitter,
    targetObj: string,
    key: string,
  ): void {
    if (this.isStaticValue(value)) {
      emitter.emit(`${targetObj}[${JSON.stringify(key)}] = ${JSON.stringify(value)};`)

      return
    }

    const resultVar = emitter.nextVar('_tv')

    emitter.emit(`var ${resultVar};`)
    this.compileTemplatePropertyValue(value, emitter, resultVar)
    emitter.emit(`${targetObj}[${JSON.stringify(key)}] = ${resultVar};`)
  }

  private compileTemplatePropertyValue(value: TemplateValue, emitter: CodeEmitter, resultVar: string): void {
    if (value === null || value === undefined) {
      emitter.emit(`${resultVar} = ${JSON.stringify(value)};`)

      return
    }

    if (this.expr.isTemplateNode(value)) {
      const templateNode = value as TemplateNode

      if (templateNode.originalType === ASTNodeType.BLOCK) {
        this.compileTemplateNestedBlock(templateNode, emitter, resultVar)

        return
      }

      this.compileExpressionWithCatch(this.expr.compileTemplateExpression(templateNode), emitter, resultVar)

      return
    }

    if (this.expr.isCompilableNode(value)) {
      this.compileASTNodeValue(value as unknown as ASTNode, emitter, resultVar)

      return
    }

    if (Array.isArray(value)) {
      const arrVar = emitter.nextVar('_tarr')

      emitter.emit(`var ${arrVar} = [];`)

      for (const element of value as TemplateValue[]) {
        if (this.isStaticValue(element)) {
          emitter.emit(`${arrVar}.push(${JSON.stringify(element)});`)

          continue
        }

        const elemVar = emitter.nextVar('_telem')

        emitter.emit(`var ${elemVar};`)
        this.compileTemplatePropertyValue(element, emitter, elemVar)
        emitter.emitBlock(`if (${elemVar} !== undefined)`, () => {
          emitter.emit(`${arrVar}.push(${elemVar});`)
        })
      }

      emitter.emit(`${resultVar} = ${arrVar};`)

      return
    }

    if (typeof value === 'object') {
      const objVar = emitter.nextVar('_tobj')

      emitter.emit(`var ${objVar} = {};`)

      for (const [key, val] of Object.entries(value as Record<string, TemplateValue>)) {
        this.compileTemplatePropertyAssignment(val, emitter, objVar, key)
      }

      emitter.emit(`${resultVar} = ${objVar};`)

      return
    }

    emitter.emit(`${resultVar} = ${JSON.stringify(value)};`)
  }

  /** Compiles a template node that represents a nested block inside an iterator yield. */
  private compileTemplateNestedBlock(block: TemplateNode, emitter: CodeEmitter, resultVar: string): void {
    const propsVar = emitter.nextVar('_tnprops')
    const blockType = block.blockType as string

    emitter.emit(`var ${propsVar} = {};`)

    const properties = block.properties ?? {}

    for (const [key, value] of Object.entries(properties)) {
      if (StepRenderCompiler.BLOCK_SKIP_PROPS.has(key)) {
        continue
      }

      this.compileTemplatePropertyAssignment(value, emitter, propsVar, key)
    }

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

  /**
   * Static values can be emitted as one JSON literal. Anything containing AST or
   * template nodes must stay on the recursive path so references, async calls,
   * and iterator scope are compiled correctly.
   */
  private isStaticValue(value: unknown): boolean {
    if (value === null || value === undefined) {
      return true
    }

    if (typeof value !== 'object') {
      return true
    }

    if (this.expr.isCompilableNode(value) || this.expr.isTemplateNode(value)) {
      return false
    }

    if (Array.isArray(value)) {
      return value.every(item => this.isStaticValue(item))
    }

    return Object.values(value as Record<string, unknown>).every(val => this.isStaticValue(val))
  }

  private isBlockNode(value: unknown): value is BlockASTNode {
    if (value === null || value === undefined || typeof value !== 'object') {
      return false
    }

    const obj = value as Record<string, unknown>

    return obj.type === ASTNodeType.BLOCK && typeof obj.variant === 'string' && typeof obj.blockType === 'string'
  }

  /** Yield templates can nest blocks below arrays or objects, so render scans before emitting loops. */
  private findTemplateBlocks(template: TemplateValue): TemplateNode[] {
    const blocks: TemplateNode[] = []

    this.walkTemplateForBlocks(template, blocks)

    return blocks
  }

  private walkTemplateForBlocks(value: TemplateValue, blocks: TemplateNode[]): void {
    if (value == null || typeof value !== 'object') {
      return
    }

    if (this.expr.isTemplateNode(value)) {
      const node = value as TemplateNode

      if (node.originalType === ASTNodeType.BLOCK) {
        blocks.push(node)

        return
      }

      if (node.properties) {
        for (const val of Object.values(node.properties)) {
          this.walkTemplateForBlocks(val, blocks)
        }
      }

      return
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        this.walkTemplateForBlocks(item, blocks)
      }

      return
    }

    for (const val of Object.values(value as Record<string, TemplateValue>)) {
      this.walkTemplateForBlocks(val, blocks)
    }
  }
}
