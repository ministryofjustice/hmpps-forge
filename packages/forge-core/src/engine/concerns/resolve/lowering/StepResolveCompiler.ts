import { BlockType, IteratorType } from '../../../../authoring/types/enums'
import { ASTNodeType } from '../../../contracts/ast/enums'
import { IterateASTNode } from '../../../contracts/ast/expressions.type'
import { BlockASTNode, JourneyASTNode, StepASTNode } from '../../../contracts/ast/structures.type'
import { TemplateNode, TemplateValue } from '../../../contracts/ast/template.type'
import { Code, code, literal, SafeCode } from '../../../compilation/codegen/Code'
import CodeGenerator from '../../../compilation/codegen/CodeGenerator'
import Name from '../../../compilation/codegen/Name'
import type { CompilationDependencies } from '../../../compilation/lowering/compilationDependencies.type'
import FieldCodeEmitter from '../../../compilation/lowering/emitters/FieldCodeEmitter'
import ExpressionDispatcher from '../../../compilation/lowering/expressions/ExpressionDispatcher'
import {
  compileGeneratedFunction,
  deriveScriptLabel,
  GENERATED_FUNCTION_HELPERS_PARAM,
  renderGeneratedSource,
} from '../../../compilation/lowering/function-construction/GeneratedFunctionCompiler'
import RuntimeValueCompiler from '../../../compilation/lowering/structures/RuntimeValueCompiler'
import ScopedTemplateCompiler, {
  isTemplateBlockNode,
} from '../../../compilation/lowering/structures/ScopedTemplateCompiler'
import type { CompiledResolveFunction } from '../../../contracts/compiled/compiledFunctions.type'

interface ResolveBlockValue {
  readonly id?: unknown
  readonly type: ASTNodeType.BLOCK
  readonly variant: string
  readonly blockType: string
  readonly properties?: Record<string, unknown>
}

interface ResolveResultNames {
  readonly blocks: Name
  readonly step: Name
  readonly ancestors: Name
}

const CONTEXT = new Name('ctx')
const HELPERS = new Name(GENERATED_FUNCTION_HELPERS_PARAM)

/** Phase compiler for the generated step render function. */
export default class StepResolveCompiler {
  private static readonly BLOCK_SKIP_PROPS = new Set(['formatters', 'parsers', 'validWhen', 'dependentWhen'])

  private static readonly STEP_SKIP_PROPS = new Set(['onAccess', 'onSubmission', 'blocks', 'reachability'])

  private static readonly JOURNEY_SKIP_PROPS = new Set(['onAccess', 'children', 'steps', 'reachability'])

  private static readonly ROOT_KEY = 'resolve-blocks'

  private readonly expr: ExpressionDispatcher

  private readonly fieldCodes: FieldCodeEmitter

  private readonly templates: ScopedTemplateCompiler

  private readonly values: RuntimeValueCompiler

  private readonly inlineIterateIds = new Set<string>()

  constructor(dependencies: CompilationDependencies) {
    this.expr = new ExpressionDispatcher(dependencies)
    this.fieldCodes = new FieldCodeEmitter(this.expr)
    this.templates = new ScopedTemplateCompiler(this.expr)
    this.values = new RuntimeValueCompiler(this.expr, {
      expressionErrorFallback: literal(undefined),
      expressionErrorMode: 'throw',
      omitUndefinedArrayItems: true,
      isStructuralValue: value => this.isResolveBlockValue(value),
      compileStructuralValue: (value, generator, target) => this.tryCompileResolveBlockValue(value, generator, target),
      noteInlineIterator: nodeId => {
        this.inlineIterateIds.add(nodeId)
      },
    })
  }

  compile(
    stepNode: StepASTNode,
    ancestorNodes: JourneyASTNode[],
    iterateNodes: IterateASTNode[] = [],
  ): CompiledResolveFunction {
    return compileGeneratedFunction<CompiledResolveFunction>(
      this.expr,
      ['ctx'],
      () => this.buildSource(stepNode, ancestorNodes, iterateNodes),
      { phase: 'resolve', label: deriveScriptLabel([stepNode]) },
    )
  }

  generateSource(stepNode: StepASTNode, ancestorNodes: JourneyASTNode[], iterateNodes: IterateASTNode[] = []): string {
    return renderGeneratedSource(this.expr, () => this.buildSource(stepNode, ancestorNodes, iterateNodes))
  }

  private buildSource(
    stepNode: StepASTNode,
    ancestorNodes: JourneyASTNode[],
    iterateNodes: IterateASTNode[],
  ): CodeGenerator {
    this.inlineIterateIds.clear()
    const generator = CodeGenerator.forFunction(['ctx'])

    generator.directive('use strict')
    generator.comment('StepResolveCompiler.buildSource')
    const names: ResolveResultNames = {
      blocks: generator.const('blocks', code`[]`),
      step: generator.const('step', code`{}`),
      ancestors: generator.const('ancestors', code`[]`),
    }

    this.compileStepMetadata(stepNode, names.step, generator)
    this.compileAncestorMetadata(ancestorNodes, names.ancestors, generator)
    this.compileBlocks(stepNode.properties.blocks ?? [], names.blocks, generator)
    this.compileIterateBlocks(iterateNodes, names.blocks, generator)
    generator.return(this.compileResolveBlocksWorkTaskExpression(names))

    return generator
  }

  private compileStepMetadata(stepNode: StepASTNode, step: Name, generator: CodeGenerator): void {
    generator.comment('StepResolveCompiler.compileStepMetadata')

    Object.entries(stepNode.properties).forEach(([key, value]) => {
      if (!StepResolveCompiler.STEP_SKIP_PROPS.has(key)) {
        this.compilePropertyAssignment(value, step, key, generator)
      }
    })
  }

  private compileAncestorMetadata(ancestorNodes: JourneyASTNode[], ancestors: Name, generator: CodeGenerator): void {
    if (ancestorNodes.length === 0) {
      return
    }

    generator.comment('StepResolveCompiler.compileAncestorMetadata')
    const composedPath = generator.let('composedPath', literal(''))

    ancestorNodes.forEach(ancestorNode => {
      generator.scope(() => {
        const ancestor = generator.const('ancestor', code`{}`)

        Object.entries(ancestorNode.properties).forEach(([key, value]) => {
          if (!StepResolveCompiler.JOURNEY_SKIP_PROPS.has(key)) {
            this.compilePropertyAssignment(value, ancestor, key, generator)
          }
        })

        generator.assign(
          composedPath,
          code`"/" + (${composedPath} + "/" + ${ancestor}.path).split("/").filter(Boolean).join("/")`,
        )
        generator.assign(code`${ancestor}.path`, composedPath)
        generator.statement(code`${ancestors}.push(${ancestor})`)
      })
      generator.blank()
    })
  }

  private compileBlocks(blocks: BlockASTNode[], targetBlocks: Name, generator: CodeGenerator): void {
    if (blocks.length === 0) {
      return
    }

    generator.comment('StepResolveCompiler.compileBlocks')
    blocks.forEach(block => {
      this.compileBlock(block, targetBlocks, generator)
      generator.blank()
    })
  }

  private compileBlock(block: BlockASTNode, targetBlocks: Name, generator: CodeGenerator): void {
    generator.comment(`StepResolveCompiler.compileBlock — ${block.variant} (${describeBlockPosition(block)})`)
    generator.scope(() => {
      const blockId = generator.const('resolveBlockId', literal(block.id))
      const props = generator.const('blockProps', code`{}`)

      this.compileBlockProperties(block.properties, block.blockType, props, blockId, undefined, generator)
      this.pushResolveBlockWorkTask(targetBlocks, blockId, block.variant, block.blockType, props, generator)
    })
  }

  private compileIterateBlocks(iterateNodes: IterateASTNode[], blocks: Name, generator: CodeGenerator): void {
    iterateNodes.forEach(iterateNode => {
      if (this.inlineIterateIds.has(iterateNode.id) || iterateNode.properties.iterator.type !== IteratorType.MAP) {
        return
      }

      const template = iterateNode.properties.iterator.yieldTemplate

      if (template === undefined) {
        return
      }

      const templateBlocks = this.findTemplateBlocks(template)

      if (templateBlocks.length === 0) {
        return
      }

      this.compileMapIteratorBlocks(iterateNode, templateBlocks, blocks, generator)
      generator.blank()
    })
  }

  private compileMapIteratorBlocks(
    iterateNode: IterateASTNode,
    templateBlocks: TemplateNode[],
    blocks: Name,
    generator: CodeGenerator,
  ): void {
    generator.comment('StepResolveCompiler.compileMapIteratorBlocks')
    this.templates.compileMapIterator(iterateNode, generator, () => {
      templateBlocks.forEach(templateBlock => {
        const codeExpression = this.templates.compileTemplateCodeExpression(templateBlock, generator)

        this.compileTemplateBlock(templateBlock, codeExpression, blocks, generator)
      })
    })
  }

  private compileTemplateBlock(
    block: TemplateNode,
    codeExpression: SafeCode | undefined,
    blocks: Name,
    generator: CodeGenerator,
  ): void {
    generator.comment('StepResolveCompiler.compileTemplateBlock')
    const blockType = String(block.blockType)

    generator.scope(() => {
      const blockId = generator.const('resolveBlockId', this.templates.compileTemplateInstanceIdExpression(block))
      const props = generator.const('templateBlockProps', code`{}`)

      this.compileBlockProperties(block.properties ?? {}, blockType, props, blockId, codeExpression, generator)
      this.pushResolveBlockWorkTask(blocks, blockId, String(block.variant), blockType, props, generator)
    })
  }

  private compileFieldValueResolution(props: Name, generator: CodeGenerator): void {
    generator.comment('StepResolveCompiler.compileFieldValueResolution')
    generator.statement(code`${HELPERS}.resolveFieldValue(${CONTEXT}, ${props})`)
  }

  private compileFieldFailureResolution(blockId: SafeCode, props: Name, generator: CodeGenerator): void {
    generator.comment('StepResolveCompiler.compileFieldFailureResolution')
    generator.statement(code`${HELPERS}.resolveFieldFailures(${CONTEXT}, ${blockId}, ${props})`)
  }

  private compileBlockProperties(
    properties: Record<string, unknown>,
    blockType: string,
    props: Name,
    blockId: SafeCode,
    codeExpression: SafeCode | undefined,
    generator: CodeGenerator,
  ): void {
    const hasVisibleWhen = 'visibleWhen' in properties
    const hoistedKeys = new Set<string>()

    if (hasVisibleWhen) {
      this.compilePropertyAssignment(properties.visibleWhen, props, 'visibleWhen', generator)
      hoistedKeys.add('visibleWhen')
    }

    if (hasVisibleWhen && blockType === BlockType.FIELD && 'code' in properties) {
      this.fieldCodes.assignProperty(properties.code, generator, props, 'code', codeExpression)
      hoistedKeys.add('code')
    }

    const compileRemainingProperties = () => {
      Object.entries(properties).forEach(([key, value]) => {
        if (StepResolveCompiler.BLOCK_SKIP_PROPS.has(key) || hoistedKeys.has(key)) {
          return
        }

        if (blockType === BlockType.FIELD && key === 'code') {
          this.fieldCodes.assignProperty(value, generator, props, key, codeExpression)

          return
        }

        this.compilePropertyAssignment(value, props, key, generator)
      })

      if (blockType === BlockType.FIELD) {
        if (properties.value === undefined) {
          this.compileFieldValueResolution(props, generator)
        }

        this.compileFieldFailureResolution(blockId, props, generator)
      }
    }

    if (hasVisibleWhen) {
      generator.if(code`${props}.visibleWhen !== false`, compileRemainingProperties)

      return
    }

    compileRemainingProperties()
  }

  private compilePropertyAssignment(value: unknown, targetObject: Name, key: string, generator: CodeGenerator): void {
    this.values.compileAssignment(value, generator, targetObject, key)
  }

  private tryCompileResolveBlockValue(value: unknown, generator: CodeGenerator, result: Name): boolean {
    if (this.expr.isTemplateNode(value)) {
      if (value.originalType !== ASTNodeType.BLOCK) {
        return false
      }

      this.compileTemplateNestedBlock(value, result, generator)

      return true
    }

    if (!this.isResolveBlockObject(value)) {
      return false
    }

    this.compileNestedBlock(value, result, generator)

    return true
  }

  private compileNestedBlock(block: ResolveBlockValue, result: Name, generator: CodeGenerator): void {
    generator.comment('StepResolveCompiler.compileNestedBlock')
    const properties = block.properties ?? {}
    const blockType = block.blockType

    generator.scope(() => {
      const blockId = generator.const('resolveBlockId', literal(block.id))
      const props = generator.const('nestedBlockProps', code`{}`)

      this.compileNestedBlockProperties(properties, blockType, blockId, props, generator)
      this.assignResolveBlockWorkTask(result, blockId, block.variant, blockType, props, generator)
    })
  }

  private compileTemplateNestedBlock(block: TemplateNode, result: Name, generator: CodeGenerator): void {
    generator.comment('StepResolveCompiler.compileTemplateNestedBlock')
    const blockType = String(block.blockType)

    generator.scope(() => {
      const blockId = generator.const('resolveBlockId', this.templates.compileTemplateInstanceIdExpression(block))
      const props = generator.const('templateNestedBlockProps', code`{}`)

      this.compileNestedBlockProperties(block.properties ?? {}, blockType, blockId, props, generator)
      this.assignResolveBlockWorkTask(result, blockId, String(block.variant), blockType, props, generator)
    })
  }

  private compileNestedBlockProperties(
    properties: Record<string, unknown>,
    blockType: string,
    blockId: Name,
    props: Name,
    generator: CodeGenerator,
  ): void {
    Object.entries(properties).forEach(([key, value]) => {
      if (StepResolveCompiler.BLOCK_SKIP_PROPS.has(key)) {
        return
      }

      if (blockType === BlockType.FIELD && key === 'code') {
        this.fieldCodes.assignProperty(value, generator, props, key)

        return
      }

      this.compilePropertyAssignment(value, props, key, generator)
    })

    if (blockType === BlockType.FIELD) {
      if (properties.value === undefined) {
        this.compileFieldValueResolution(props, generator)
      }

      this.compileFieldFailureResolution(blockId, props, generator)
    }
  }

  private pushResolveBlockWorkTask(
    targetBlocks: Name,
    blockId: Name,
    variant: string,
    blockType: string,
    props: Name,
    generator: CodeGenerator,
  ): void {
    generator.statement(
      code`${targetBlocks}.push(${this.compileResolveBlockWorkTaskExpression(blockId, variant, blockType, props)})`,
    )
  }

  private assignResolveBlockWorkTask(
    result: Name,
    blockId: Name,
    variant: string,
    blockType: string,
    props: Name,
    generator: CodeGenerator,
  ): void {
    generator.assign(result, this.compileResolveBlockWorkTaskExpression(blockId, variant, blockType, props))
  }

  private compileResolveBlockWorkTaskExpression(blockId: Name, variant: string, blockType: string, props: Name): Code {
    return code`${CONTEXT}.workTasks.resolveBlock(${blockId}, ${variant}, ${blockType}, ${props})`
  }

  private compileResolveBlocksWorkTaskExpression(names: ResolveResultNames): Code {
    return code`${CONTEXT}.workTasks.resolveBlocks(${names.blocks}, ${names.step}, ${names.ancestors})`
  }

  private isResolveBlockValue(value: unknown): boolean {
    return this.expr.isTemplateNode(value) ? value.originalType === ASTNodeType.BLOCK : this.isResolveBlockObject(value)
  }

  private isResolveBlockObject(value: unknown): value is ResolveBlockValue {
    if (value === null || value === undefined || typeof value !== 'object') {
      return false
    }

    const objectValue = value as Record<string, unknown>

    return objectValue.type === ASTNodeType.BLOCK &&
      typeof objectValue.variant === 'string' &&
      typeof objectValue.blockType === 'string'
  }

  private findTemplateBlocks(template: TemplateValue): TemplateNode[] {
    return this.templates.findTemplateNodes(template, isTemplateBlockNode, { descendIntoMatches: false })
  }
}

function describeBlockPosition(block: BlockASTNode): string {
  const pathTail = block.diagnostics?.source.formattedPath.split(' > ').at(-1)

  return pathTail?.replace(/ \(.*\)$/, '') ?? String(block.id)
}
