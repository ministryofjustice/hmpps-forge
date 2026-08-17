import { BlockType } from '../../../../authoring/types/enums'
import { isTemplateNode } from '../../../contracts/ast/nodes'
import type { TemplateNode } from '../../../contracts/ast/template.type'
import {
  AuthoredValueKind,
  toRawOperand,
  type AuthoredValue,
  type BlockValue,
  type RecordEntryValue,
} from '../../../contracts/models/authoredValue.type'
import { CodeFragment, code, literal, SafeCode } from '../../../compilation/lowering/codegen/fragments/CodeFragment'
import CodeGenerator from '../../../compilation/lowering/codegen/CodeGenerator'
import IdentifierName from '../../../compilation/lowering/codegen/fragments/IdentifierName'
import type { CompilationDependencies } from '../../../compilation/lowering/compilationDependencies.type'
import FieldCodeEmitter from '../../../compilation/lowering/emitters/FieldCodeEmitter'
import ExpressionDispatcher from '../../../compilation/lowering/expressions/ExpressionDispatcher'
import {
  CompilationPhase,
  compileGeneratedFunction,
  GENERATED_FUNCTION_RUNTIME_LIBRARY_PARAM,
  renderGeneratedSource,
} from '../../../compilation/lowering/GeneratedFunctionCompiler'
import RuntimeValueCompiler from '../../../compilation/lowering/structures/RuntimeValueCompiler'
import ScopedTemplateCompiler from '../../../compilation/lowering/structures/ScopedTemplateCompiler'
import type { CompiledResolveFunction } from '../../../contracts/compiled/compiledFunctions.type'
import type {
  ResolveAncestorModel,
  ResolveBlockModel,
  ResolveModel,
  ResolvePropertyModel,
} from '../contracts/resolveModel.type'

interface ResolveResultNames {
  readonly blocks: IdentifierName
  readonly step: IdentifierName
  readonly ancestors: IdentifierName
}

const CONTEXT = new IdentifierName('ctx')
const HELPERS = new IdentifierName(GENERATED_FUNCTION_RUNTIME_LIBRARY_PARAM)

/** Compiler for the resolve phase: builds the generated function that prepares a step's blocks, metadata, and ancestors for rendering. */
export default class StepResolveCompiler {
  private readonly expr: ExpressionDispatcher

  private readonly fieldCodes: FieldCodeEmitter

  private readonly templates: ScopedTemplateCompiler

  private readonly values: RuntimeValueCompiler

  constructor(dependencies: CompilationDependencies) {
    this.expr = new ExpressionDispatcher(dependencies)
    this.fieldCodes = new FieldCodeEmitter(this.expr)
    this.templates = new ScopedTemplateCompiler(this.expr)
    this.values = new RuntimeValueCompiler(this.expr, {
      expressionErrorFallback: literal(undefined),
      expressionErrorMode: 'throw',
      omitUndefinedArrayItems: true,
      compileBlockValue: (block, generator, target) => this.compileNestedBlockValue(block, generator, target),
    })
  }

  compile(model: ResolveModel): CompiledResolveFunction {
    return compileGeneratedFunction<CompiledResolveFunction>(this.expr, ['ctx'], () => this.buildSource(model), {
      phase: CompilationPhase.RESOLVE,
      label: model.label,
    })
  }

  generateSource(model: ResolveModel): string {
    return renderGeneratedSource(this.expr, () => this.buildSource(model))
  }

  private buildSource(model: ResolveModel): CodeGenerator {
    const generator = CodeGenerator.forFunction(['ctx'])

    generator.directive('use strict')
    generator.comment('StepResolveCompiler.buildSource')
    const names: ResolveResultNames = {
      blocks: generator.const('blocks', code`[]`),
      step: generator.const('step', code`{}`),
      ancestors: generator.const('ancestors', code`[]`),
    }

    this.compileStepMetadata(model.step, names.step, generator)
    this.compileAncestorMetadata(model.ancestors, names.ancestors, generator)
    this.compileBlocks(model.blocks, names.blocks, generator)
    this.compileIterateBlocks(model, names.blocks, generator)
    generator.return(this.compileResolveBlocksWorkTaskExpression(names))

    return generator
  }

  private compileStepMetadata(
    properties: readonly ResolvePropertyModel[],
    step: IdentifierName,
    generator: CodeGenerator,
  ): void {
    generator.comment('StepResolveCompiler.compileStepMetadata')

    properties.forEach(property => {
      this.compilePropertyAssignment(property.value, step, property.key, generator)
    })
  }

  private compileAncestorMetadata(
    ancestors: readonly ResolveAncestorModel[],
    ancestorsName: IdentifierName,
    generator: CodeGenerator,
  ): void {
    if (ancestors.length === 0) {
      return
    }

    generator.comment('StepResolveCompiler.compileAncestorMetadata')

    // When every ancestor path is a plain string the full path was built at
    // compile time (during analysis); otherwise the generated code rebuilds
    // the whole chain per request.
    if (ancestors.every(ancestor => ancestor.composedPath !== undefined)) {
      ancestors.forEach(ancestorModel => {
        generator.scope(() => {
          const ancestor = this.compileAncestorProperties(ancestorModel, generator)

          generator.assign(code`${ancestor}.path`, literal(ancestorModel.composedPath))
          generator.statement(code`${ancestorsName}.push(${ancestor})`)
        })
        generator.blank()
      })

      return
    }

    const composedPath = generator.let('composedPath', literal(''))

    ancestors.forEach(ancestorModel => {
      generator.scope(() => {
        const ancestor = this.compileAncestorProperties(ancestorModel, generator)

        generator.assign(
          composedPath,
          code`"/" + (${composedPath} + "/" + ${ancestor}.path).split("/").filter(Boolean).join("/")`,
        )
        generator.assign(code`${ancestor}.path`, composedPath)
        generator.statement(code`${ancestorsName}.push(${ancestor})`)
      })
      generator.blank()
    })
  }

  private compileAncestorProperties(ancestorModel: ResolveAncestorModel, generator: CodeGenerator): IdentifierName {
    const ancestor = generator.const('ancestor', code`{}`)

    ancestorModel.properties.forEach(property => {
      this.compilePropertyAssignment(property.value, ancestor, property.key, generator)
    })

    return ancestor
  }

  private compileBlocks(
    blocks: readonly ResolveBlockModel[],
    targetBlocks: IdentifierName,
    generator: CodeGenerator,
  ): void {
    if (blocks.length === 0) {
      return
    }

    generator.comment('StepResolveCompiler.compileBlocks')
    blocks.forEach(block => {
      this.compileBlock(block, targetBlocks, generator)
      generator.blank()
    })
  }

  private compileBlock(block: ResolveBlockModel, targetBlocks: IdentifierName, generator: CodeGenerator): void {
    generator.comment(`StepResolveCompiler.compileBlock — ${block.variant} (${block.label})`)
    generator.scope(() => {
      const blockId = generator.const('resolveBlockId', literal(block.id))
      const props = generator.const('blockProps', code`{}`)

      this.compileBlockProperties(block, props, blockId, undefined, generator)
      this.pushResolveBlockWorkTask(targetBlocks, blockId, block.variant, block.blockType, props, generator)
    })
  }

  private compileIterateBlocks(model: ResolveModel, blocks: IdentifierName, generator: CodeGenerator): void {
    model.standaloneIterateBlocks.forEach(iterateModel => {
      generator.comment('StepResolveCompiler.compileMapIteratorBlocks')
      this.templates.compileMapIterator(iterateModel.node, generator, () => {
        iterateModel.templateBlocks.forEach(templateBlock => {
          const codeExpression = this.templates.compileTemplateCodeExpression(
            templateBlock.source as TemplateNode,
            generator,
          )

          this.compileTemplateBlock(templateBlock, codeExpression, blocks, generator)
        })
      })
      generator.blank()
    })
  }

  private compileTemplateBlock(
    block: ResolveBlockModel,
    codeExpression: SafeCode | undefined,
    blocks: IdentifierName,
    generator: CodeGenerator,
  ): void {
    generator.comment('StepResolveCompiler.compileTemplateBlock')
    generator.scope(() => {
      const blockId = generator.const(
        'resolveBlockId',
        this.templates.compileTemplateInstanceIdExpression(block.source as TemplateNode),
      )
      const props = generator.const('templateBlockProps', code`{}`)

      this.compileBlockProperties(block, props, blockId, codeExpression, generator)
      this.pushResolveBlockWorkTask(blocks, blockId, block.variant, block.blockType, props, generator)
    })
  }

  private compileFieldValueResolution(props: IdentifierName, generator: CodeGenerator): void {
    generator.comment('StepResolveCompiler.compileFieldValueResolution')
    generator.statement(code`${HELPERS}.resolveFieldValue(${CONTEXT}, ${props})`)
  }

  private compileFieldFailureResolution(blockId: SafeCode, props: IdentifierName, generator: CodeGenerator): void {
    generator.comment('StepResolveCompiler.compileFieldFailureResolution')
    generator.statement(code`${HELPERS}.resolveFieldFailures(${CONTEXT}, ${blockId}, ${props})`)
  }

  private compileBlockProperties(
    block: ResolveBlockModel,
    props: IdentifierName,
    blockId: SafeCode,
    codeExpression: SafeCode | undefined,
    generator: CodeGenerator,
  ): void {
    const visibleWhen = block.properties.find(property => property.key === 'visibleWhen')
    const hasVisibleWhen = visibleWhen !== undefined
    const codeProperty = block.properties.find(property => property.key === 'code')
    const hoistedKeys = new Set<string>()

    if (visibleWhen !== undefined) {
      this.compilePropertyAssignment(visibleWhen.value, props, 'visibleWhen', generator)
      hoistedKeys.add('visibleWhen')
    }

    if (hasVisibleWhen && block.blockType === BlockType.FIELD && codeProperty !== undefined) {
      this.fieldCodes.assignProperty(toRawOperand(codeProperty.value), generator, props, 'code', codeExpression)
      hoistedKeys.add('code')
    }

    const compileRemainingProperties = () => {
      block.properties.forEach(property => {
        if (hoistedKeys.has(property.key)) {
          return
        }

        if (block.blockType === BlockType.FIELD && property.key === 'code') {
          this.fieldCodes.assignProperty(toRawOperand(property.value), generator, props, property.key, codeExpression)

          return
        }

        this.compilePropertyAssignment(property.value, props, property.key, generator)
      })

      if (block.blockType === BlockType.FIELD) {
        if (block.resolvesFieldValue) {
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

  private compilePropertyAssignment(
    value: AuthoredValue,
    targetObject: IdentifierName,
    key: string,
    generator: CodeGenerator,
  ): void {
    this.values.compileAssignment(value, generator, targetObject, key)
  }

  private compileNestedBlockValue(block: BlockValue, generator: CodeGenerator, result: IdentifierName): void {
    if (isTemplateNode(block.source)) {
      this.compileTemplateNestedBlock(block, block.source, result, generator)

      return
    }

    this.compileNestedBlock(block, result, generator)
  }

  private compileNestedBlock(block: BlockValue, result: IdentifierName, generator: CodeGenerator): void {
    generator.comment('StepResolveCompiler.compileNestedBlock')
    generator.scope(() => {
      const blockId = generator.const('resolveBlockId', literal(block.id))
      const props = generator.const('nestedBlockProps', code`{}`)

      this.compileNestedBlockProperties(block, blockId, props, generator)
      this.assignResolveBlockWorkTask(result, blockId, block.variant, block.blockType, props, generator)
    })
  }

  private compileTemplateNestedBlock(
    block: BlockValue,
    source: TemplateNode,
    result: IdentifierName,
    generator: CodeGenerator,
  ): void {
    generator.comment('StepResolveCompiler.compileTemplateNestedBlock')
    generator.scope(() => {
      const blockId = generator.const('resolveBlockId', this.templates.compileTemplateInstanceIdExpression(source))
      const props = generator.const('templateNestedBlockProps', code`{}`)

      this.compileNestedBlockProperties(block, blockId, props, generator)
      this.assignResolveBlockWorkTask(result, blockId, block.variant, block.blockType, props, generator)
    })
  }

  private compileNestedBlockProperties(
    block: BlockValue,
    blockId: IdentifierName,
    props: IdentifierName,
    generator: CodeGenerator,
  ): void {
    block.entries.forEach(entry => {
      if (block.blockType === BlockType.FIELD && entry.key === 'code') {
        this.fieldCodes.assignProperty(toRawOperand(entry.value), generator, props, entry.key)

        return
      }

      this.compilePropertyAssignment(entry.value, props, entry.key, generator)
    })

    if (block.blockType === BlockType.FIELD) {
      if (this.nestedBlockResolvesFieldValue(block.entries)) {
        this.compileFieldValueResolution(props, generator)
      }

      this.compileFieldFailureResolution(blockId, props, generator)
    }
  }

  /** Returns true when the block has no explicit `value` property, matching the authored block's own `properties.value === undefined` check. */
  private nestedBlockResolvesFieldValue(entries: readonly RecordEntryValue[]): boolean {
    const valueEntry = entries.find(entry => entry.key === 'value')

    return valueEntry === undefined ||
      (valueEntry.value.kind === AuthoredValueKind.STATIC && valueEntry.value.value === undefined)
  }

  private pushResolveBlockWorkTask(
    targetBlocks: IdentifierName,
    blockId: IdentifierName,
    variant: string,
    blockType: string,
    props: IdentifierName,
    generator: CodeGenerator,
  ): void {
    generator.statement(
      code`${targetBlocks}.push(${this.compileResolveBlockWorkTaskExpression(blockId, variant, blockType, props)})`,
    )
  }

  private assignResolveBlockWorkTask(
    result: IdentifierName,
    blockId: IdentifierName,
    variant: string,
    blockType: string,
    props: IdentifierName,
    generator: CodeGenerator,
  ): void {
    generator.assign(result, this.compileResolveBlockWorkTaskExpression(blockId, variant, blockType, props))
  }

  private compileResolveBlockWorkTaskExpression(
    blockId: IdentifierName,
    variant: string,
    blockType: string,
    props: IdentifierName,
  ): CodeFragment {
    return code`${CONTEXT}.workTasks.resolveBlock(${blockId}, ${variant}, ${blockType}, ${props})`
  }

  private compileResolveBlocksWorkTaskExpression(names: ResolveResultNames): CodeFragment {
    return code`${CONTEXT}.workTasks.resolveBlocks(${names.blocks}, ${names.step}, ${names.ancestors})`
  }
}
