import type { IterateASTNode } from '../ast/expressions.type'
import type { FieldBlockASTNode } from '../ast/structures.type'
import type { TemplateNode } from '../ast/template.type'
import type { AuthoredValue, ExpressionValue } from './authoredValue.type'

/**
 * One field occurrence, registered or template-produced, as the analysis stage
 * hands it to lowering. Built once per step by `FieldModelBuilder`; consumed by
 * the answer-preparation, validation, and answer-cleardown compilers. AST nodes
 * survive here only as expression leaves and diagnostic tokens.
 */
export interface FieldModel {
  /** Diagnostics only — never queried structurally past analysis. */
  readonly source: FieldBlockASTNode | TemplateNode
  /** Iterator nesting this occurrence sits under; empty for registered fields. */
  readonly iteratorPath: readonly IterateRef[]
  readonly code?: StaticFieldCode | DynamicFieldCode
  readonly component: FieldComponentModel
  readonly formatters?: TransformerPipeline
  readonly parsers?: TransformerPipeline
  readonly defaultValue?: AuthoredValue
  readonly dependentWhen?: AuthoredValue
  readonly validation?: FieldValidationModel
  /** Human-readable identity, e.g. `govukInput "name"` — serves generated comments. */
  readonly label: string
}

/** One level of iterator nesting: the registered or template MAP iterate node. */
export interface IterateRef {
  readonly node: IterateASTNode | TemplateNode
}

export enum FieldCodeKind {
  STATIC = 'static',
  DYNAMIC = 'dynamic',
}

export interface StaticFieldCode {
  readonly kind: FieldCodeKind.STATIC
  readonly value: string
}

export interface DynamicFieldCode {
  readonly kind: FieldCodeKind.DYNAMIC
  readonly node: ExpressionValue
}

/** Component facts resolved from the registry at analysis time. */
export interface FieldComponentModel {
  readonly variant: string
  readonly acceptsMultipleValues: boolean
  readonly validatesInput: boolean
}

/** One authored transformer call in a formatter/parser pipeline. */
export interface TransformerCall {
  readonly name: string
  readonly arguments: readonly AuthoredValue[]
  /** Diagnostic token for tracked-call metadata. */
  readonly node: ExpressionValue
}

export type TransformerPipeline = readonly TransformerCall[]

export interface FieldValidationModel {
  readonly rules: ValidationRulesModel
}

export enum ValidationRulesKind {
  DIRECT = 'direct',
  DYNAMIC = 'dynamic',
}

/** An authored array of validation rule expressions, compiled rule-by-rule. */
export interface DirectRules {
  readonly kind: ValidationRulesKind.DIRECT
  readonly rules: readonly ExpressionValue[]
}

/** Any other authored rules shape, materialised through the runtime value compiler. */
export interface DynamicRules {
  readonly kind: ValidationRulesKind.DYNAMIC
  readonly value: AuthoredValue
}

export type ValidationRulesModel = DirectRules | DynamicRules
