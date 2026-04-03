import {
  FunctionExpr,
  PipelineExpr,
  PredicateExpr,
  ReferenceExpr,
  TransformerFunctionExpr,
  FormatExpr,
  ConditionalExpr,
  MatchExpr,
} from '../../authoring/types/expressions.type'
import { PredicateTestExprBuilder } from '../../authoring/builders/PredicateTestExprBuilder'
import { ConditionalExprBuilder } from '../../authoring/builders/ConditionalExprBuilder'
import { MatchExprBuilder } from '../../authoring/builders/MatchExprBuilder'
import { ChainableExpr, ChainableIterable, ChainableRef } from '../../authoring/builders/types'
import { BlockType, StructureType } from '../../authoring/types/enums'
import type { ValidationExpr } from '../../authoring/types/structures.type'

/**
 * Props for basic (non-field) block components.
 * Use this as the base for component Props interfaces.
 */
export interface BasicBlockProps {
  /**
   * Conditional visibility - the block is not rendered when this evaluates to truthy.
   * Hidden fields retain their values and still participate in validation.
   *
   * To also skip validation and clear the value, use `dependent` on field blocks.
   *
   * @example true // Always hidden
   * @example Answer('contactMethod').not.match(Condition.Equals('email')) // Hide unless email selected
   */
  hidden?: boolean | PredicateExpr | PredicateTestExprBuilder

  /**
   * Optional metadata for the field.
   * Can be used for analytics, debugging, or custom processing.
   *
   * @example { section: 'personal-details', priority: 'high' }
   */
  metadata?: {
    [key: string]: any
  }
}

/**
 * Base interface for all block types in forge.
 * Blocks are the fundamental building units of form UI.
 */
export interface BlockDefinition extends BasicBlockProps {
  type: StructureType.BLOCK

  /** The specific variant/type of block (e.g., 'text', 'number', 'radio', etc.) */
  variant: string

  /** Discriminator to distinguish field blocks from regular blocks */
  blockType: BlockType
}

/**
 * Props for field block components.
 * Use this as the base for field component Props interfaces.
 */
export interface FieldBlockProps extends BasicBlockProps {
  /**
   * Unique identifier for the field within the form.
   * Used for storing answers and referencing the field value.
   *
   * @example 'email'
   * @example 'date_of_birth'
   * @example Format('task_%1_status', Item().path('id')) // Dynamic code in iterators
   */
  code: ConditionalString

  /**
   * Initial or computed value for the field.
   * Can be a static value, a reference to another field, or a computed expression.
   *
   * @example 'United Kingdom' // Static default
   * @example Answer('previousEmail') // Copy from another field
   * @example Data('user.name') // From loaded data
   */
  defaultValue?: ConditionalString | ConditionalString[] | FunctionExpr<any>

  /**
   * Array of transformers to format/process the field value before rendering/storing.
   * Transformers only affect submitted values, and run AFTER sanitization.
   *
   * @example [Transformer.String.Trim()] // Remove whitespace
   * @example [Transformer.String.Uppercase(), Transformer.String.SnakeCase()] // Convert to uppercase snake_case
   */
  formatters?: TransformerFunctionExpr[]

  /**
   * Array of validation rules to apply to the field value.
   * Validations run in order; first failure shows its error message.
   */
  validate?: ValidationExpr[]

  /**
   * Marks field as dependent on other fields.
   * When the predicate evaluates to false, validation is skipped and the answer is cleared.
   *
   * **Note:** This does not affect rendering — the field is still visible.
   * To visually hide a conditional field, use `hidden` alongside `dependent`.
   * They are typically logical opposites: `hidden` controls visibility,
   * `dependent` controls validation and value retention.
   *
   * @example
   * // Only validate and keep this field's value when appointmentType is 'phone'
   * dependent: Answer('appointmentType').match(Condition.Equals('phone'))
   * // Pair with hidden to also control visibility:
   * hidden: Answer('appointmentType').not.match(Condition.Equals('phone'))
   */
  dependent?: PredicateExpr

  /**
   * Whether to keep all values when an array is returned (e.g., checkboxes).
   * When false (default), only the first non-empty value is used.
   * When true, all values in the array are kept.
   *
   * @default false
   * @example true // For checkbox groups
   */
  multiple?: boolean
}

/**
 * Block definition for form field blocks.
 * Represents user input fields with validation and formatting.
 */
export interface FieldBlockDefinition extends BlockDefinition, FieldBlockProps {}

export type ConditionalString =
  | string
  | ReferenceExpr
  | FormatExpr
  | PipelineExpr
  | ConditionalExpr
  | MatchExpr
  | ConditionalExprBuilder
  | MatchExprBuilder
  | ChainableRef
  | ChainableExpr<any>

export type ConditionalBoolean =
  | boolean
  | ReferenceExpr
  | PipelineExpr
  | ConditionalExpr
  | MatchExpr
  | ConditionalExprBuilder
  | MatchExprBuilder
  | ChainableRef
  | ChainableExpr<any>

export type ConditionalNumber =
  | number
  | ReferenceExpr
  | PipelineExpr
  | ConditionalExpr
  | MatchExpr
  | ConditionalExprBuilder
  | MatchExprBuilder
  | ChainableRef
  | ChainableExpr<any>

export type ConditionalArray<T> =
  | T[]
  | ReferenceExpr
  | PipelineExpr
  | ConditionalExpr
  | MatchExpr
  | ConditionalExprBuilder
  | MatchExprBuilder
  | ChainableIterable
  | ChainableRef
  | ChainableExpr<any>

export type RenderedBlock = {
  block: BlockDefinition
  html: string
}

export type EvaluatedBlock<T, IsRoot extends boolean = true> = T extends ConditionalString
  ? string
  : T extends ConditionalBoolean
    ? boolean
    : T extends ConditionalNumber
      ? number
      : T extends ConditionalArray<infer U>
        ? EvaluatedBlock<U, false>[]
        : T extends (infer U)[]
          ? EvaluatedBlock<U, false>[]
          : T extends FieldBlockDefinition
            ? IsRoot extends true
              ? { [K in keyof T]: K extends 'type' | 'variant' ? T[K] : EvaluatedBlock<T[K], false> } & {
                  value?: unknown
                  errors?: { message: string; details?: Record<string, any> }[]
                }
              : RenderedBlock
            : T extends BlockDefinition
              ? IsRoot extends true
                ? { [K in keyof T]: K extends 'type' | 'variant' ? T[K] : EvaluatedBlock<T[K], false> } & {
                    value?: unknown
                  }
                : RenderedBlock
              : T extends object
                ? { [K in keyof T]: K extends 'type' | 'variant' ? T[K] : EvaluatedBlock<T[K], false> }
                : T
