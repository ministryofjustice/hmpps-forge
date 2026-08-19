import { BlockType } from '../../../../authoring/types/enums'
import { isTemplateNode } from '../../../chassis/contracts/ast/nodes'
import type { TemplateNode } from '../../../chassis/contracts/ast/template.type'
import {
  AuthoredValueKind,
  toRawOperand,
  type AuthoredValue,
  type BlockValue,
  type RecordEntryValue,
} from '../../../chassis/contracts/models/authoredValue.type'
import {
  CodeFragment,
  code,
  literal,
  objectCode,
  structuredLiteralCode,
  SafeCode,
  ObjectCodeProperty,
} from '../../../chassis/compilation/lowering/codegen/fragments/CodeFragment'
import CodeGenerator from '../../../chassis/compilation/lowering/codegen/CodeGenerator'
import IdentifierName from '../../../chassis/compilation/lowering/codegen/fragments/IdentifierName'
import type { CompilationDependencies } from '../../../chassis/compilation/lowering/compilationDependencies.type'
import FieldCodeEmitter from '../../../chassis/compilation/lowering/emitters/FieldCodeEmitter'
import ExpressionDispatcher from '../../../chassis/compilation/lowering/expressions/ExpressionDispatcher'
import {
  CompilationPhase,
  compileGeneratedFunction,
  GENERATED_FUNCTION_RUNTIME_LIBRARY_PARAM,
  renderGeneratedSource,
} from '../../../chassis/compilation/lowering/GeneratedFunctionCompiler'
import RuntimeValueCompiler from '../../../chassis/compilation/lowering/structures/RuntimeValueCompiler'
import ScopedTemplateCompiler from '../../../chassis/compilation/lowering/structures/ScopedTemplateCompiler'
import type { CompiledResolveFunction } from '../../../chassis/contracts/compiled/compiledFunctions.type'
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

/** Everything one block-props construction needs, shared by top-level, template, and nested blocks. */
interface BlockPropsCompilation {
  readonly properties: readonly ResolvePropertyModel[]
  readonly blockType: string
  readonly variant: string
  readonly resolvesFieldValue: boolean
  readonly blockId: SafeCode
  readonly codeExpression: SafeCode | undefined
  readonly namePrefix: string
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
      compileBlockValue: (block, generator, nameHint) => this.compileNestedBlockValue(block, generator, nameHint),
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
    const names: ResolveResultNames = {
      blocks: generator.const('blocks', code`[]`),
      step: generator.const('step', this.staticPropertiesLiteral(model.step)),
      ancestors: generator.const('ancestors', code`[]`),
    }

    this.compileDynamicProperties(model.step, names.step, generator)
    this.compileAncestorMetadata(model.ancestors, names.ancestors, generator)
    this.compileBlocks(model.blocks, names.blocks, generator)
    this.compileIterateBlocks(model, names.blocks, generator)
    generator.return(this.compileResolveBlocksWorkTaskExpression(names))

    return generator
  }

  private staticPropertiesLiteral(properties: readonly ResolvePropertyModel[]): CodeFragment {
    return objectCode(this.staticPropertyEntries(properties))
  }

  private staticPropertyEntries(properties: readonly ResolvePropertyModel[]): ObjectCodeProperty[] {
    return properties.flatMap(property =>
      property.value.kind === AuthoredValueKind.STATIC
        ? [{ key: property.key, value: structuredLiteralCode(property.value.value) }]
        : [],
    )
  }

  private compileDynamicProperties(
    properties: readonly ResolvePropertyModel[],
    target: IdentifierName,
    generator: CodeGenerator,
  ): void {
    properties
      .filter(property => property.value.kind !== AuthoredValueKind.STATIC)
      .forEach(property => this.compilePropertyAssignment(property.value, target, property.key, generator))
  }

  private compileAncestorMetadata(
    ancestors: readonly ResolveAncestorModel[],
    ancestorsName: IdentifierName,
    generator: CodeGenerator,
  ): void {
    if (ancestors.length === 0) {
      return
    }

    generator.comment('Ancestor journeys')

    // When every ancestor path is a plain string the full path was built at
    // compile time (during analysis); otherwise the generated code rebuilds
    // the whole chain per request.
    if (ancestors.every(ancestor => ancestor.composedPath !== undefined)) {
      ancestors.forEach(ancestorModel => {
        this.compileComposedAncestor(ancestorModel, ancestorsName, generator)
      })

      return
    }

    const composedPath = generator.let('composedPath', literal(''))

    ancestors.forEach(ancestorModel => {
      const ancestor = generator.const('ancestor', this.staticPropertiesLiteral(ancestorModel.properties))

      this.compileDynamicProperties(ancestorModel.properties, ancestor, generator)
      generator.assign(
        composedPath,
        code`"/" + (${composedPath} + "/" + ${ancestor}.path).split("/").filter(Boolean).join("/")`,
      )
      generator.assign(code`${ancestor}.path`, composedPath)
      generator.statement(code`${ancestorsName}.push(${ancestor})`)
      generator.blank()
    })
  }

  /**
   * Pushes one ancestor whose full path was composed at analysis: the
   * authored relative path never appears — the composed path takes its place
   * in the literal.
   */
  private compileComposedAncestor(
    ancestorModel: ResolveAncestorModel,
    ancestorsName: IdentifierName,
    generator: CodeGenerator,
  ): void {
    const staticEntries = this.staticPropertyEntries(ancestorModel.properties).map(entry =>
      entry.key === 'path' ? { key: 'path', value: literal(ancestorModel.composedPath) } : entry,
    )
    const entries = staticEntries.some(entry => entry.key === 'path')
      ? staticEntries
      : [...staticEntries, { key: 'path', value: literal(ancestorModel.composedPath) }]
    const dynamicProperties = ancestorModel.properties.filter(
      property => property.value.kind !== AuthoredValueKind.STATIC,
    )

    if (dynamicProperties.length === 0) {
      generator.statement(code`${ancestorsName}.push(${objectCode(entries)})`)

      return
    }

    const ancestor = generator.const('ancestor', objectCode(entries))

    dynamicProperties.forEach(property =>
      this.compilePropertyAssignment(property.value, ancestor, property.key, generator),
    )
    generator.statement(code`${ancestorsName}.push(${ancestor})`)
  }

  private compileBlocks(
    blocks: readonly ResolveBlockModel[],
    targetBlocks: IdentifierName,
    generator: CodeGenerator,
  ): void {
    blocks.forEach(block => {
      this.compileBlock(block, targetBlocks, generator)
      generator.blank()
    })
  }

  private compileBlock(block: ResolveBlockModel, targetBlocks: IdentifierName, generator: CodeGenerator): void {
    const blockId = literal(block.id)
    const props = this.compileBlockProperties(
      this.toBlockPropsCompilation(block, blockId, undefined, this.toBlockPropsName(block.variant)),
      generator,
      `Block — ${block.variant} (${block.label})`,
    )

    this.pushResolveBlockWorkTask(targetBlocks, blockId, block.variant, block.blockType, props, generator)
  }

  private compileIterateBlocks(model: ResolveModel, blocks: IdentifierName, generator: CodeGenerator): void {
    model.standaloneIterateBlocks.forEach(iterateModel => {
      generator.comment('Iterator blocks')
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
    const blockId = generator.const(
      'resolveBlockId',
      this.templates.compileTemplateInstanceIdExpression(block.source as TemplateNode),
    )
    const props = this.compileBlockProperties(
      this.toBlockPropsCompilation(block, blockId, codeExpression, this.toBlockPropsName(block.variant)),
      generator,
      `Template block — ${block.variant} (${block.label})`,
    )

    this.pushResolveBlockWorkTask(blocks, blockId, block.variant, block.blockType, props, generator)
  }

  private toBlockPropsCompilation(
    block: ResolveBlockModel,
    blockId: SafeCode,
    codeExpression: SafeCode | undefined,
    namePrefix: string,
  ): BlockPropsCompilation {
    return {
      properties: block.properties,
      blockType: block.blockType,
      variant: block.variant,
      resolvesFieldValue: block.resolvesFieldValue,
      blockId,
      codeExpression,
      namePrefix,
    }
  }

  private compileBlockProperties(
    plan: BlockPropsCompilation,
    generator: CodeGenerator,
    comment: string,
  ): IdentifierName {
    const visibleWhen = plan.properties.find(property => property.key === 'visibleWhen')

    if (visibleWhen === undefined) {
      return this.compileUngatedBlockProps(plan, generator, comment)
    }

    generator.comment(comment)

    return this.compileVisibilityGatedBlockProps(plan, visibleWhen, generator)
  }

  /**
   * The common shape: one props literal per block with every expressible
   * property inline. Values that need statements — nested blocks especially —
   * hoist into their own named units above the literal, so the block's
   * comment sits directly on its props const, after any hoisted children.
   */
  private compileUngatedBlockProps(
    plan: BlockPropsCompilation,
    generator: CodeGenerator,
    comment: string,
  ): IdentifierName {
    const boundPlan = this.toSelfBoundPlan(plan, generator)

    return this.expr.withSelfCodeExpression(boundPlan.codeExpression, () => {
      const entries = this.compileBlockPropEntries(boundPlan, generator)

      generator.comment(comment)
      const props = generator.const(boundPlan.namePrefix, objectCode(entries))

      this.compileFieldResolution(boundPlan, props, generator)

      return props
    })
  }

  /**
   * Resolves a FIELD block's code expression ahead of property compilation so
   * `Self()` references in the block's properties can bind to it. Hoisted once
   * outside the `withSelfCodeExpression` scope, so the code expression itself
   * never self-resolves.
   */
  private toSelfBoundPlan(plan: BlockPropsCompilation, generator: CodeGenerator): BlockPropsCompilation {
    if (plan.blockType !== BlockType.FIELD || plan.codeExpression !== undefined) {
      return plan
    }

    const codeProperty = plan.properties.find(property => property.key === 'code')

    if (codeProperty === undefined) {
      return plan
    }

    return {
      ...plan,
      codeExpression: this.fieldCodes.compileRegisteredExpression(toRawOperand(codeProperty.value), generator),
    }
  }

  private compileBlockPropEntries(plan: BlockPropsCompilation, generator: CodeGenerator): ObjectCodeProperty[] {
    return plan.properties.flatMap(property => {
      if (plan.blockType === BlockType.FIELD && property.key === 'code') {
        const codeExpression =
          plan.codeExpression ?? this.fieldCodes.compileRegisteredInlineExpression(toRawOperand(property.value))

        return codeExpression === undefined ? [] : [{ key: 'code', value: codeExpression }]
      }

      return [{ key: property.key, value: this.values.compileValueExpression(property.value, generator, property.key) }]
    })
  }

  /**
   * A `visibleWhen` block evaluates its predicate first and only materialises
   * the remaining properties when the block is visible, so those assignments
   * stay statement-per-property inside the gate.
   */
  private compileVisibilityGatedBlockProps(
    plan: BlockPropsCompilation,
    visibleWhen: ResolvePropertyModel,
    generator: CodeGenerator,
  ): IdentifierName {
    const boundPlan = this.toSelfBoundPlan(plan, generator)

    return this.expr.withSelfCodeExpression(boundPlan.codeExpression, () => {
      const props = generator.const(boundPlan.namePrefix, code`{}`)
      const hoistedKeys = new Set<string>(['visibleWhen'])
      const codeProperty = boundPlan.properties.find(property => property.key === 'code')

      this.compilePropertyAssignment(visibleWhen.value, props, 'visibleWhen', generator)

      if (boundPlan.blockType === BlockType.FIELD && codeProperty !== undefined) {
        this.fieldCodes.assignProperty(
          toRawOperand(codeProperty.value),
          generator,
          props,
          'code',
          boundPlan.codeExpression,
        )
        hoistedKeys.add('code')
      }

      generator.if(code`${props}.visibleWhen !== false`, () => {
        boundPlan.properties
          .filter(property => !hoistedKeys.has(property.key))
          .forEach(property => this.compileBlockPropAssignment(property, boundPlan, props, generator))
        this.compileFieldResolution(boundPlan, props, generator)
      })

      return props
    })
  }

  private compileBlockPropAssignment(
    property: ResolvePropertyModel,
    plan: BlockPropsCompilation,
    props: IdentifierName,
    generator: CodeGenerator,
  ): void {
    if (plan.blockType === BlockType.FIELD && property.key === 'code') {
      this.fieldCodes.assignProperty(toRawOperand(property.value), generator, props, property.key, plan.codeExpression)

      return
    }

    this.compilePropertyAssignment(property.value, props, property.key, generator)
  }

  private compileFieldResolution(plan: BlockPropsCompilation, props: IdentifierName, generator: CodeGenerator): void {
    if (plan.blockType !== BlockType.FIELD) {
      return
    }

    if (plan.resolvesFieldValue) {
      generator.statement(code`${HELPERS}.resolveFieldValue(${CONTEXT}, ${props})`)
    }

    generator.statement(
      code`${HELPERS}.resolveFieldFailures(${CONTEXT}, ${plan.blockId}, ${literal(plan.variant)}, ${props})`,
    )
  }

  private compilePropertyAssignment(
    value: AuthoredValue,
    targetObject: IdentifierName,
    key: string,
    generator: CodeGenerator,
  ): void {
    this.values.compileAssignment(value, generator, targetObject, key)
  }

  /**
   * Emits a nested block as its own named unit — comment, props const,
   * resolve const — and returns the const so the parent literal references
   * it by name. Children therefore always appear above their parent.
   */
  private compileNestedBlockValue(block: BlockValue, generator: CodeGenerator, nameHint: string): SafeCode {
    if (isTemplateNode(block.source)) {
      return this.compileTemplateNestedBlock(block, block.source, nameHint, generator)
    }

    return this.compileNestedBlock(block, nameHint, generator)
  }

  private compileNestedBlock(block: BlockValue, nameHint: string, generator: CodeGenerator): IdentifierName {
    const blockName = this.toNestedBlockName(block, nameHint)
    const blockId = literal(block.id)
    const props = this.compileUngatedBlockProps(
      this.toNestedBlockPropsCompilation(block, blockId, `${blockName}Props`),
      generator,
      this.toNestedBlockComment(block, nameHint),
    )
    const result = generator.const(
      blockName,
      this.compileResolveBlockWorkTaskExpression(blockId, block.variant, block.blockType, props),
    )

    generator.blank()

    return result
  }

  private compileTemplateNestedBlock(
    block: BlockValue,
    source: TemplateNode,
    nameHint: string,
    generator: CodeGenerator,
  ): IdentifierName {
    const blockName = this.toNestedBlockName(block, nameHint)
    const blockId = generator.const('resolveBlockId', this.templates.compileTemplateInstanceIdExpression(source))
    const props = this.compileUngatedBlockProps(
      this.toNestedBlockPropsCompilation(block, blockId, `${blockName}Props`),
      generator,
      this.toNestedBlockComment(block, nameHint),
    )
    const result = generator.const(
      blockName,
      this.compileResolveBlockWorkTaskExpression(blockId, block.variant, block.blockType, props),
    )

    generator.blank()

    return result
  }

  private toNestedBlockPropsCompilation(
    block: BlockValue,
    blockId: SafeCode,
    namePrefix: string,
  ): BlockPropsCompilation {
    return {
      properties: block.entries,
      blockType: block.blockType,
      variant: block.variant,
      resolvesFieldValue: this.nestedBlockResolvesFieldValue(block.entries),
      blockId,
      codeExpression: undefined,
      namePrefix,
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
    blockId: SafeCode,
    variant: string,
    blockType: string,
    props: IdentifierName,
    generator: CodeGenerator,
  ): void {
    generator.statement(
      code`${targetBlocks}.push(${this.compileResolveBlockWorkTaskExpression(blockId, variant, blockType, props)})`,
    )
  }

  private compileResolveBlockWorkTaskExpression(
    blockId: SafeCode,
    variant: string,
    blockType: string,
    props: IdentifierName,
  ): CodeFragment {
    return code`${CONTEXT}.workTasks.resolveBlock(${blockId}, ${variant}, ${blockType}, ${props})`
  }

  private compileResolveBlocksWorkTaskExpression(names: ResolveResultNames): CodeFragment {
    return code`${CONTEXT}.workTasks.resolveBlocks(${names.blocks}, ${names.step}, ${names.ancestors})`
  }

  private toBlockPropsName(variant: string): string {
    return `${this.toVariantName(variant)}Props`
  }

  private toVariantName(variant: string): string {
    return this.camelise(variant.replace(/^(govuk|moj)-?/i, ''))
  }

  /**
   * Names a nested block unit: the authored field code when it is a static
   * string, otherwise the slot or property the block lives under plus the
   * last word of the variant (`basic-example` + `templateWrapper` becomes
   * `basicExampleWrapper`).
   */
  private toNestedBlockName(block: BlockValue, nameHint: string): string {
    const staticCode = this.staticFieldCode(block)

    if (staticCode !== undefined) {
      const name = this.camelise(staticCode)

      if (name.length > 0) {
        return name
      }
    }

    const base = this.camelise(nameHint)

    if (base.length === 0) {
      return this.toVariantName(block.variant)
    }

    const tail = this.variantTail(block.variant)

    return base.toLowerCase().endsWith(tail.toLowerCase()) ? base : `${base}${tail}`
  }

  private toNestedBlockComment(block: BlockValue, nameHint: string): string {
    const staticCode = this.staticFieldCode(block)

    if (staticCode !== undefined) {
      return `Block — ${block.variant} "${staticCode}"`
    }

    return nameHint.length > 0 ? `Block — ${block.variant} (${nameHint})` : `Block — ${block.variant}`
  }

  private staticFieldCode(block: BlockValue): string | undefined {
    const codeEntry = block.entries.find(entry => entry.key === 'code')

    if (
      codeEntry !== undefined &&
      codeEntry.value.kind === AuthoredValueKind.STATIC &&
      typeof codeEntry.value.value === 'string'
    ) {
      return codeEntry.value.value
    }

    return undefined
  }

  private variantTail(variant: string): string {
    const words = variant.match(/[A-Z]?[a-z0-9]+|[A-Z]+/g) ?? [variant]
    const lastWord = words[words.length - 1]

    return `${lastWord.charAt(0).toUpperCase()}${lastWord.slice(1)}`
  }

  private camelise(value: string): string {
    const words = value.match(/[A-Za-z0-9]+/g) ?? []

    if (words.length === 0) {
      return ''
    }

    const firstWord = words[0] ?? ''
    const restWords = words.slice(1)
    const name = `${firstWord.charAt(0).toLowerCase()}${firstWord.slice(1)}${restWords
      .map(word => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
      .join('')}`

    return /^[A-Za-z_$]/.test(name) ? name : `block${name.charAt(0).toUpperCase()}${name.slice(1)}`
  }
}
