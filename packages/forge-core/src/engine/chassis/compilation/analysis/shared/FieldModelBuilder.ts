import { BlockType, ExpressionType, FunctionType, IteratorType } from '../../../../../authoring/types/enums'
import { ASTNodeType } from '../../../contracts/ast/enums'
import type { IterateASTNode } from '../../../contracts/ast/expressions.type'
import { isTemplateNode } from '../../../contracts/ast/nodes'
import type { FieldBlockASTNode } from '../../../contracts/ast/structures.type'
import type { TemplateNode, TemplateValue } from '../../../contracts/ast/template.type'
import { expressionValue, isExpressionLeaf, type AuthoredValue } from '../../../contracts/models/authoredValue.type'
import {
  FieldCodeKind,
  type DynamicFieldCode,
  type FieldComponentModel,
  type FieldModel,
  type FieldValidationModel,
  type IterateRef,
  type StaticFieldCode,
  type TransformerPipeline,
} from '../../../contracts/models/fieldModel.type'
import { classifyValidationRules, hasConfiguredValue } from '../../../contracts/models/validationRules'
import ForgeInternalError from '../../../../errors/ForgeInternalError'
import AuthoredValueClassifier from './AuthoredValueClassifier'
import type ComponentRegistry from '../../../registries/ComponentRegistry'

interface TemplateMapIteratorProperties {
  readonly input?: unknown
  readonly iterator?: {
    readonly type?: unknown
    readonly yieldTemplate?: TemplateValue
  }
}

/**
 * Builds a `FieldModel` for every field a step can produce — registered field
 * blocks first, then fields inside MAP iterator templates, in document order.
 * This is the analysis stage's single walk over template structure: the
 * lowering compilers (which turn analysis models into generated JavaScript)
 * iterate the resulting flat list and never re-walk the template tree.
 */
export default class FieldModelBuilder {
  constructor(
    private readonly componentRegistry: ComponentRegistry,
    private readonly classifier: AuthoredValueClassifier = new AuthoredValueClassifier(),
  ) {}

  buildStepFields(fieldBlocks: readonly FieldBlockASTNode[], mapIterateNodes: readonly IterateASTNode[]): FieldModel[] {
    const fields: FieldModel[] = []

    fieldBlocks.forEach(block => {
      fields.push(this.buildRegisteredField(block))
    })
    mapIterateNodes.forEach(iterateNode => {
      this.collectIterateFields(iterateNode, fields)
    })

    return fields
  }

  private buildRegisteredField(block: FieldBlockASTNode): FieldModel {
    const fieldCode = this.classifyFieldCode(block.properties.code)
    const component = this.resolveComponent(block.variant)

    return {
      source: block,
      iteratorPath: [],
      code: fieldCode,
      component,
      formatters: this.classifyTransformers(block.properties.formatters),
      parsers: this.classifyTransformers(block.properties.parsers),
      defaultValue: this.classifyDefaultValue(block.properties.defaultValue),
      dependentWhen: this.classifyDependentWhen(block.properties.dependentWhen),
      validation: this.classifyValidation(block.properties.validWhen),
      label: this.deriveFieldLabel(component.variant, fieldCode),
    }
  }

  private collectIterateFields(iterateNode: IterateASTNode, fields: FieldModel[]): void {
    const { iterator } = iterateNode.properties

    if (iterator.type !== IteratorType.MAP || iterator.yieldTemplate === undefined) {
      return
    }

    this.collectTemplateFields(iterator.yieldTemplate, [{ node: iterateNode }], fields)
  }

  private collectTemplateFields(template: TemplateValue, iteratorPath: IterateRef[], fields: FieldModel[]): void {
    if (template === null || template === undefined || typeof template !== 'object') {
      return
    }

    if (isTemplateNode(template)) {
      if (template.originalType === ASTNodeType.EXPRESSION && template.expressionType === ExpressionType.ITERATE) {
        this.collectNestedIterateFields(template, iteratorPath, fields)

        return
      }

      if (template.originalType === ASTNodeType.BLOCK && template.blockType === BlockType.FIELD) {
        fields.push(this.buildTemplateField(template, iteratorPath))
      }

      Object.values(template.properties ?? {}).forEach(child => {
        this.collectTemplateFields(child as TemplateValue, iteratorPath, fields)
      })

      return
    }

    if (Array.isArray(template)) {
      template.forEach(item => {
        this.collectTemplateFields(item, iteratorPath, fields)
      })

      return
    }

    Object.values(template as Record<string, TemplateValue>).forEach(item => {
      this.collectTemplateFields(item, iteratorPath, fields)
    })
  }

  private collectNestedIterateFields(template: TemplateNode, iteratorPath: IterateRef[], fields: FieldModel[]): void {
    const properties = (template.properties ?? {}) as TemplateMapIteratorProperties
    const iterator = properties.iterator

    if (iterator?.type !== IteratorType.MAP || iterator.yieldTemplate === undefined) {
      return
    }

    this.collectTemplateFields(iterator.yieldTemplate, [...iteratorPath, { node: template }], fields)
  }

  private buildTemplateField(template: TemplateNode, iteratorPath: IterateRef[]): FieldModel {
    const properties = template.properties ?? {}
    const variant = typeof template.variant === 'string' ? template.variant : ''
    const fieldCode = this.classifyTemplateFieldCode(properties.code)
    const component = this.resolveComponent(variant)

    return {
      source: template,
      iteratorPath: [...iteratorPath],
      code: fieldCode,
      component,
      formatters: this.classifyTransformers(properties.formatters),
      parsers: this.classifyTransformers(properties.parsers),
      defaultValue: this.classifyDefaultValue(properties.defaultValue),
      dependentWhen: this.classifyDependentWhen(properties.dependentWhen),
      validation: this.classifyValidation(properties.validWhen),
      label: this.deriveFieldLabel(component.variant, fieldCode),
    }
  }

  private classifyFieldCode(fieldCode: unknown): StaticFieldCode | DynamicFieldCode | undefined {
    if (typeof fieldCode === 'string') {
      return { kind: FieldCodeKind.STATIC, value: fieldCode }
    }

    if (isExpressionLeaf(fieldCode)) {
      return { kind: FieldCodeKind.DYNAMIC, node: expressionValue(fieldCode) }
    }

    return undefined
  }

  /** Template field codes are only ever static strings or template expressions. */
  private classifyTemplateFieldCode(fieldCode: unknown): StaticFieldCode | DynamicFieldCode | undefined {
    if (typeof fieldCode === 'string') {
      return { kind: FieldCodeKind.STATIC, value: fieldCode }
    }

    if (isTemplateNode(fieldCode)) {
      return { kind: FieldCodeKind.DYNAMIC, node: expressionValue(fieldCode) }
    }

    return undefined
  }

  /**
   * A missing variant is impossible for authored components — semantic analysis
   * has already rejected unregistered variants. The empty variant covers
   * template fields whose variant is not a static string; those resolve to a
   * component with no input schema, matching the registry's absent-entry shape.
   */
  private resolveComponent(variant: string): FieldComponentModel {
    if (variant === '') {
      return { variant, acceptsMultipleValues: false, validatesInput: false }
    }

    const component = this.componentRegistry.get(variant)

    if (component === undefined) {
      throw new ForgeInternalError(`Component "${variant}" is not registered`)
    }

    return {
      variant,
      acceptsMultipleValues: component.multiple === true,
      validatesInput: component.inputSchema !== undefined,
    }
  }

  /** Entries that aren't AST nodes are skipped. A node that isn't a transformer call can't happen in valid authored code. */
  private classifyTransformers(transformers: unknown): TransformerPipeline | undefined {
    if (!Array.isArray(transformers)) {
      return undefined
    }

    const calls = transformers.filter(isExpressionLeaf).map(transformerNode => {
      const name = readTransformerName(transformerNode)

      if (name === undefined) {
        throw new ForgeInternalError('Formatter entry is not a transformer function call')
      }

      return {
        name,
        arguments: readTransformerArguments(transformerNode).map(argument => this.classifier.classify(argument)),
        node: expressionValue(transformerNode),
      }
    })

    return calls.length > 0 ? calls : undefined
  }

  private classifyDefaultValue(defaultValue: unknown): AuthoredValue | undefined {
    return defaultValue === undefined ? undefined : this.classifier.classify(defaultValue)
  }

  private classifyDependentWhen(dependentWhen: unknown): AuthoredValue | undefined {
    if (!dependentWhen || !isExpressionLeaf(dependentWhen)) {
      return undefined
    }

    return this.classifier.classify(dependentWhen)
  }

  private classifyValidation(validWhen: unknown): FieldValidationModel | undefined {
    if (!hasConfiguredValue(validWhen)) {
      return undefined
    }

    return { rules: classifyValidationRules(validWhen, value => this.classifier.classify(value)) }
  }

  private deriveFieldLabel(variant: string, fieldCode: StaticFieldCode | DynamicFieldCode | undefined): string {
    const variantLabel = variant === '' ? 'unknown component' : variant

    if (fieldCode === undefined) {
      return variantLabel
    }

    return fieldCode.kind === FieldCodeKind.STATIC
      ? `${variantLabel} "${fieldCode.value}"`
      : `${variantLabel} (dynamic code)`
  }
}

function readTransformerName(value: object): string | undefined {
  if (readExpressionType(value) !== FunctionType.TRANSFORMER) {
    return undefined
  }

  const name = readTransformerProperties(value).name

  return typeof name === 'string' ? name : undefined
}

function readTransformerArguments(value: object): unknown[] {
  const argumentsValue = readTransformerProperties(value).arguments

  return Array.isArray(argumentsValue) ? argumentsValue : []
}

// A transformer call carries name/arguments on `properties`; loosely authored
// shapes may carry them on the value itself.
function readTransformerProperties(value: object): Record<string, unknown> {
  return readProperties(value) ?? (value as Record<string, unknown>)
}

function readExpressionType(value: object): unknown {
  const record = value as Record<string, unknown>

  return record.expressionType ?? record.type
}

function readProperties(value: object): Record<string, unknown> | undefined {
  const properties = (value as Record<string, unknown>).properties

  return properties !== null && typeof properties === 'object' && !Array.isArray(properties)
    ? (properties as Record<string, unknown>)
    : undefined
}
